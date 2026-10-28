'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { findProduct, getAllProducts } from '@/lib/products';
import { calculateCart, checkoutOrder, createRazorpayOrder, verifyPayment, recordPaymentFailure, getPaymentMode } from '@/lib/api';
import { getTranslation } from '@/lib/translations';
import { recordEvent } from '@/lib/analytics';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {


  const [cart, setCart] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('astroveda_cart_v2');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn('Error reading stored cart:', e);
      }
    }
    return [];
  });

  const [wishlist, setWishlist] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('astroveda_wishlist_v2');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn('Error reading stored wishlist:', e);
      }
    }
    return [];
  });

  const [cartOpen, setCartOpen] = useState(false);
  const [wishOpen, setWishOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [productModal, setProductModal] = useState({ show: false, title: null });
  const [trackingModal, setTrackingModal] = useState({ show: false, orderNumber: '', token: '', email: '' });
  const [contactModal, setContactModal] = useState({ show: false });
  const [articleModal, setArticleModal] = useState({ show: false, slug: '', article: null });
  const [brandLogo, setBrandLogo] = useState('/swami-guruji-logo-cropped.jpg');

  // Multilingual state ('mr' | 'hi' | 'en')
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('astroveda_lang_v1');
        if (saved) return saved;
      } catch (e) {}
    }
    return 'mr';
  });

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('astroveda_lang_v1', newLang);
      } catch (e) {}
    }
  }, []);

  const t = useCallback((key, fallback = '') => {
    return getTranslation(lang, key, fallback);
  }, [lang]);

  // Server calculation & checkout states
  const [couponCode, setCouponCode] = useState('');
  const [serverCart, setServerCart] = useState({
    subtotal: 0,
    discount_amount: 0,
    coupon_applied: null,
    tax_amount: 0,
    shipping_amount: 0,
    total_amount: 0,
    loading: false,
    error: null,
  });

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('form'); // 'form' | 'confirmed'
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  // Store payment mode: 'online' or 'offline'
  const [paymentMode, setPaymentMode] = useState('online');
  const [offlineInstructions, setOfflineInstructions] = useState('');
  const [offlineQrCode, setOfflineQrCode] = useState('/phonepe-qr.jpg');

  // Fetch store payment mode on mount and periodically sync
  useEffect(() => {
    let isMounted = true;
    const loadMode = () => {
      getPaymentMode()
        .then(res => {
          if (isMounted && res) {
            if (res.payment_mode) setPaymentMode(res.payment_mode);
            if (res.offline_payment_instructions) setOfflineInstructions(res.offline_payment_instructions);
            if (res.offline_qr_code) setOfflineQrCode(res.offline_qr_code);
          }
        })
        .catch(() => {});
    };

    loadMode();
    const interval = setInterval(loadMode, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('astroveda_cart_v2', JSON.stringify(cart));
    } catch (e) {
      console.warn('Error storing cart:', e);
    }
  }, [cart]);

  // Sync wishlist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('astroveda_wishlist_v2', JSON.stringify(wishlist));
    } catch (e) {
      console.warn('Error storing wishlist:', e);
    }
  }, [wishlist]);

  // Restore saved coupon on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('astroveda_saved_coupon_v1');
      if (saved) {
        setCouponCode(saved);
      }
    } catch (e) {
      // storage unavailable
    }
  }, []);

  // Sync coupon to localStorage
  useEffect(() => {
    try {
      if (couponCode) {
        localStorage.setItem('astroveda_saved_coupon_v1', couponCode);
      } else {
        localStorage.removeItem('astroveda_saved_coupon_v1');
      }
    } catch (e) {
      // storage unavailable
    }
  }, [couponCode]);

  // Lock background scroll when any drawer or modal is active for optimal mobile & desktop UX
  useEffect(() => {
    const isAnyActive = cartOpen || wishOpen || searchOpen || drawerOpen || checkoutOpen || productModal.show || trackingModal.show || contactModal.show || articleModal.show;
    if (typeof document !== 'undefined') {
      if (isAnyActive) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [cartOpen, wishOpen, searchOpen, drawerOpen, checkoutOpen, productModal.show, trackingModal.show, contactModal.show, articleModal.show]);

  // Recalculate authoritative server totals whenever cart items or coupon change
  useEffect(() => {
    let isCancelled = false;

    const runCalculation = async () => {
      if (cart.length === 0) {
        if (!isCancelled) {
          setServerCart({
            subtotal: 0,
            discount_amount: 0,
            coupon_applied: null,
            tax_amount: 0,
            shipping_amount: 0,
            total_amount: 0,
            loading: false,
            error: null,
          });
        }
        return;
      }

      setServerCart(prev => ({ ...prev, loading: true, error: null }));
      const payloadItems = cart.map(item => ({
        product_id: item.id,
        quantity: item.qty,
      }));

      try {
        const res = await calculateCart(payloadItems, couponCode);
        if (!isCancelled) {
          setServerCart({
            subtotal: res.subtotal,
            discount_amount: res.discount_amount || 0,
            coupon_applied: res.coupon_applied || null,
            tax_amount: res.tax_amount || 0,
            shipping_amount: res.shipping_amount || 0,
            total_amount: res.total_amount,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!isCancelled) {
          // Graceful client fallback if API is temporarily unavailable
          const clientSubtotal = cart.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
          const clientTax = Math.round(clientSubtotal * 0.03 * 100) / 100;
          const clientShipping = clientSubtotal >= 999 ? 0 : 99;
          setServerCart({
            subtotal: clientSubtotal,
            discount_amount: 0,
            coupon_applied: null,
            tax_amount: clientTax,
            shipping_amount: clientShipping,
            total_amount: clientSubtotal + clientTax + clientShipping,
            loading: false,
            error: err.message,
          });
        }
      }
    };

    runCalculation();

    return () => {
      isCancelled = true;
    };
  }, [cart, couponCode]);

  const showToast = useCallback((msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 2200);
  }, []);

  /**
   * Add product by canonical backend ID or title
   */
  const addToCart = useCallback((productOrTitle, rawPrice) => {
    let canonical = null;
    if (typeof productOrTitle === 'object' && productOrTitle !== null) {
      canonical = productOrTitle;
    } else {
      canonical = findProduct(productOrTitle);
    }

    const title = canonical ? (canonical.title || canonical.name) : String(productOrTitle);
    const id = canonical ? canonical.id : 3;
    const price = canonical
      ? (canonical.priceNum ?? (parseInt(String(canonical.price || rawPrice).replace(/[^\d]/g, ''), 10) || 0))
      : (parseInt(String(rawPrice).replace(/[^\d]/g, ''), 10) || 0);
    const img = canonical ? (canonical.img || (canonical.images && canonical.images[0]) || '') : '';
    const sku = canonical ? (canonical.sku || 'BRC-NAV') : 'BRC-NAV';
    const slug = canonical ? (canonical.slug || 'product') : 'product';

    setCart(prev => {
      const existing = prev.find(it => it.id === id || it.title === title);
      if (existing) {
        return prev.map(it => (it.id === id || it.title === title) ? { ...it, qty: it.qty + 1 } : it);
      }
      return [...prev, { id, title, price, qty: 1, img, sku, slug }];
    });

    setCartOpen(true);
    setWishOpen(false);
    setSearchOpen(false);
    showToast(`${title} — cart मध्ये जोडले`);

    recordEvent({
      type: 'action',
      path: typeof window !== 'undefined' ? window.location.pathname : '/',
      section: 'cart-panel',
      title: `Added ${title} to Cart`,
      metadata: { action_name: 'add_to_cart', item_title: title, item_sku: sku }
    });
  }, [showToast]);

  const removeFromCart = useCallback((idOrIndex) => {
    setCart(prev => prev.filter((it, i) => {
      if (typeof idOrIndex === 'number' && idOrIndex >= 0 && idOrIndex < prev.length) {
        return i !== idOrIndex;
      }
      return it.id !== idOrIndex;
    }));
    showToast('Item removed from cart');
  }, [showToast]);

  const updateCartQty = useCallback((idOrIndex, delta) => {
    setCart(prev => {
      const updated = prev.map((it, i) => {
        const matches = (typeof idOrIndex === 'number' && i === idOrIndex) || it.id === idOrIndex;
        if (matches) {
          return { ...it, qty: it.qty + delta };
        }
        return it;
      });
      return updated.filter(it => it.qty > 0);
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const toggleWishlist = useCallback((productOrTitle, rawPrice) => {
    let canonical = null;
    if (typeof productOrTitle === 'object' && productOrTitle !== null) {
      canonical = productOrTitle;
    } else {
      canonical = findProduct(productOrTitle);
    }

    const title = canonical ? (canonical.title || canonical.name) : String(productOrTitle);
    const id = canonical ? canonical.id : 3;
    const price = canonical
      ? (canonical.priceNum ?? (parseInt(String(canonical.price || rawPrice).replace(/[^\d]/g, ''), 10) || 0))
      : (parseInt(String(rawPrice).replace(/[^\d]/g, ''), 10) || 0);
    const img = canonical ? (canonical.img || (canonical.images && canonical.images[0]) || '') : '';
    const sku = canonical ? (canonical.sku || 'BRC-NAV') : 'BRC-NAV';
    const slug = canonical ? (canonical.slug || 'product') : 'product';

    setWishlist(prev => {
      const idx = prev.findIndex(it => it.id === id || it.title === title);
      if (idx === -1) {
        showToast(`${title} — wishlist मध्ये जोडले`);
        return [...prev, { id, title, price, img, sku, slug }];
      } else {
        showToast(`${title} — wishlist मधून काढले`);
        return prev.filter((_, i) => i !== idx);
      }
    });
  }, [showToast]);

  const removeFromWishlist = useCallback((indexOrId) => {
    setWishlist(prev => prev.filter((it, i) => (typeof indexOrId === 'number' && i === indexOrId) ? false : it.id !== indexOrId));
    showToast('Item removed from wishlist');
  }, [showToast]);

  const moveToCart = useCallback((indexOrId) => {
    const item = typeof indexOrId === 'number' ? wishlist[indexOrId] : wishlist.find(it => it.id === indexOrId);
    if (!item) return;
    addToCart(item, item.price);
    setWishlist(prev => prev.filter((it, i) => (typeof indexOrId === 'number' ? i !== indexOrId : it.id !== indexOrId)));
  }, [wishlist, addToCart]);

  const closeAll = useCallback(() => {
    setCartOpen(false);
    setWishOpen(false);
    setSearchOpen(false);
    setDrawerOpen(false);
    setCheckoutOpen(false);
    setTrackingModal({ show: false, orderNumber: '', token: '', email: '' });
    setContactModal({ show: false });
    setArticleModal({ show: false, slug: '', article: null });
  }, []);

  const openProductModal = useCallback((titleOrProduct, initialImageIdx = 0) => {
    let prod = null;
    let titleStr = '';
    let selectedIdx = 0;
    if (typeof titleOrProduct === 'object' && titleOrProduct !== null) {
      prod = titleOrProduct;
      titleStr = titleOrProduct.title || titleOrProduct.name;
      if (typeof titleOrProduct.activeImageIdx === 'number') {
        selectedIdx = titleOrProduct.activeImageIdx;
      } else if (typeof initialImageIdx === 'number') {
        selectedIdx = initialImageIdx;
      }
    } else {
      prod = findProduct(titleOrProduct);
      titleStr = prod ? prod.title : String(titleOrProduct);
      if (typeof initialImageIdx === 'number') {
        selectedIdx = initialImageIdx;
      }
    }
    setProductModal({ show: true, product: prod, title: titleStr, activeImageIdx: selectedIdx });
    recordEvent({
      type: 'modal_open',
      path: typeof window !== 'undefined' ? window.location.pathname : '/',
      section: 'product-modal',
      title: `Viewed Product: ${titleStr}`,
      metadata: { modal_name: 'product_modal', product_title: titleStr }
    });
  }, []);

  const closeProductModal = useCallback(() => {
    setProductModal({ show: false, product: null, title: null });
  }, []);

  const openTracking = useCallback((orderNumber = '', token = '', email = '') => {
    setTrackingModal({ show: true, orderNumber, token, email });
    setCartOpen(false);
    setWishOpen(false);
    setSearchOpen(false);
    setDrawerOpen(false);
  }, []);

  const closeTracking = useCallback(() => {
    setTrackingModal({ show: false, orderNumber: '', token: '', email: '' });
  }, []);

  const openContact = useCallback(() => {
    setContactModal({ show: true });
    setCartOpen(false);
    setWishOpen(false);
    setSearchOpen(false);
    setDrawerOpen(false);
  }, []);

  const closeContact = useCallback(() => {
    setContactModal({ show: false });
  }, []);

  const openArticleModal = useCallback((slugOrArticle) => {
    if (typeof slugOrArticle === 'object' && slugOrArticle !== null) {
      setArticleModal({ show: true, slug: slugOrArticle.slug || '', article: slugOrArticle });
    } else {
      setArticleModal({ show: true, slug: String(slugOrArticle), article: null });
    }
  }, []);

  const closeArticleModal = useCallback(() => {
    setArticleModal({ show: false, slug: '', article: null });
  }, []);

  // Checkout workflow methods
  const openCheckout = useCallback(() => {
    setCartOpen(false);
    setCheckoutError(null);
    setCheckoutStep('form');
    setCheckoutOpen(true);
  }, []);

  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false);
  }, []);

  const submitCheckout = useCallback(async (customerData, paymentMethod = 'Razorpay') => {
    if (cart.length === 0) {
      setCheckoutError('Your cart is empty');
      return { success: false, error: 'Cart is empty' };
    }

    setCheckoutLoading(true);
    setCheckoutError(null);

    // Generate random client-side idempotency key for network resilience
    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const isOffline = paymentMode === 'offline' || paymentMethod === 'Offline / Direct UPI / Bank Transfer' || paymentMethod === 'Offline Payment';
    const effectivePaymentMethod = isOffline ? 'Offline Payment' : (paymentMethod || 'Razorpay');

    const payload = {
      customer_name: customerData.name.trim(),
      customer_email: customerData.email.trim(),
      customer_phone: customerData.phone.trim(),
      shipping_address: customerData.address.trim(),
      payment_method: effectivePaymentMethod,
      payment_mode: isOffline ? 'offline' : 'online',
      coupon_code: couponCode.trim(),
      items: cart.map(item => ({
        product_id: item.id,
        quantity: item.qty,
      })),
    };

    try {
      const result = await checkoutOrder(payload, idempotencyKey);

      // Store secure order access token in localStorage for devotee tracking
      if (result.order_number && result.access_token) {
        try {
          const storedTokens = JSON.parse(localStorage.getItem('astroveda_order_tokens') || '{}');
          storedTokens[result.order_number] = result.access_token;
          localStorage.setItem('astroveda_order_tokens', JSON.stringify(storedTokens));
        } catch (e) {
          console.warn('Could not save order token:', e);
        }
      }

      // Offline mode or Cash on Delivery: finish without Razorpay gateway
      if (isOffline || result.offline_payment || effectivePaymentMethod === 'Cash on Delivery' || result.payment_status === 'offline_pending') {
        setLastOrder(result);
        setCheckoutStep('confirmed');
        clearCart();
        setCheckoutLoading(false);
        return { success: true, order: result };
      }

      // Online Razorpay Payment Flow
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        throw new Error('Could not load Razorpay payment gateway. Please check your internet connection or try again.');
      }

      let rzpDetails = result.razorpay;
      if (!rzpDetails || !rzpDetails.order_id) {
        // Fallback: request order creation from backend
        const orderRes = await createRazorpayOrder({
          order_number: result.order_number,
          token: result.access_token,
        });
        rzpDetails = {
          order_id: orderRes.razorpay_order_id,
          amount: orderRes.amount,
          currency: orderRes.currency || 'INR',
          key_id: orderRes.key_id,
        };
      }

      return new Promise((resolve) => {
        let paymentFailedHandled = false;

        const options = {
          key: rzpDetails.key_id,
          amount: rzpDetails.amount,
          currency: rzpDetails.currency || 'INR',
          name: 'AstroVeda',
          description: `Order ${result.order_number}`,
          order_id: rzpDetails.order_id,
          prefill: {
            name: customerData.name,
            email: customerData.email,
            contact: customerData.phone,
          },
          theme: {
            color: '#d97706',
          },
          modal: {
            ondismiss: async () => {
              setCheckoutLoading(false);
              if (!paymentFailedHandled) {
                try {
                  await recordPaymentFailure({
                    order_number: result.order_number,
                    token: result.access_token,
                    error_code: 'MODAL_DISMISSED',
                    error_description: 'Payment was dismissed by user before completion',
                    razorpay_order_id: rzpDetails.order_id,
                  });
                } catch (e) {
                  console.warn('Error recording payment dismissal:', e);
                }
                setCheckoutError('पेमेंट रद्द केले गेले. तुम्ही पुन्हा प्रयत्न करू शकता. (Payment was cancelled. You can retry.)');
                resolve({ success: false, cancelled: true });
              }
            },
          },
          handler: async function (response) {
            setCheckoutLoading(true);
            try {
              // Authoritative cryptographic verification on backend (never trust browser callback alone!)
              const verifyRes = await verifyPayment({
                order_number: result.order_number,
                token: result.access_token,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              if (verifyRes.status === 'success' || verifyRes.payment_status === 'paid' || verifyRes.status === 'already_verified') {
                const confirmedOrder = {
                  ...result,
                  payment_status: 'paid',
                  order_status: 'processing',
                  transaction_number: verifyRes.transaction_number,
                  gateway_payment_id: response.razorpay_payment_id,
                };
                setLastOrder(confirmedOrder);
                setCheckoutStep('confirmed');
                clearCart();
                setCheckoutLoading(false);
                resolve({ success: true, order: confirmedOrder });
              } else {
                const errMsg = verifyRes.message || 'Payment signature verification failed. Order not marked paid.';
                setCheckoutError(errMsg);
                setCheckoutLoading(false);
                resolve({ success: false, error: errMsg });
              }
            } catch (vErr) {
              const errMsg = vErr.message || 'Payment verification failed. Please contact support.';
              setCheckoutError(errMsg);
              setCheckoutLoading(false);
              resolve({ success: false, error: errMsg });
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async function (failedResp) {
          paymentFailedHandled = true;
          setCheckoutLoading(false);
          const errCode = failedResp.error?.code || 'PAYMENT_FAILED';
          const errDesc = failedResp.error?.description || 'Payment was declined by bank or gateway';
          try {
            await recordPaymentFailure({
              order_number: result.order_number,
              token: result.access_token,
              error_code: errCode,
              error_description: errDesc,
              razorpay_order_id: failedResp.error?.metadata?.order_id || rzpDetails.order_id,
              razorpay_payment_id: failedResp.error?.metadata?.payment_id,
            });
          } catch (e) {
            console.warn('Error recording payment failure:', e);
          }
          setCheckoutError(`पेमेंट अयशस्वी: ${errDesc} (Payment failed: ${errDesc}. You can retry.)`);
          resolve({ success: false, error: errDesc });
        });

        rzp.open();
      });
    } catch (err) {
      setCheckoutError(err.message || 'Failed to place order. Please verify your details.');
      setCheckoutLoading(false);
      return { success: false, error: err.message };
    }
  }, [cart, couponCode, clearCart, paymentMode]);

  const cartCount = cart.reduce((s, it) => s + it.qty, 0);
  const cartSubtotal = cart.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
  const isInWishlist = (titleOrId) => wishlist.some(it => it.id === titleOrId || it.title === titleOrId);

  return (
    <StoreContext.Provider value={{
      cart, wishlist, cartOpen, wishOpen, searchOpen, drawerOpen, toast,
      productModal, cartCount, cartSubtotal, isInWishlist,
      addToCart, removeFromCart, updateCartQty, clearCart,
      toggleWishlist, removeFromWishlist, moveToCart,
      setCartOpen, setWishOpen, setSearchOpen, setDrawerOpen, closeAll,
      openProductModal, closeProductModal, showToast,
      // Checkout & Server Calculation
      serverCart, couponCode, setCouponCode,
      checkoutOpen, checkoutStep, checkoutLoading, checkoutError, lastOrder,
      openCheckout, closeCheckout, submitCheckout,
      // Payment Mode
      paymentMode, setPaymentMode, offlineInstructions, offlineQrCode,
      // Connected Modals & Workflows
      trackingModal, openTracking, closeTracking,
      contactModal, openContact, closeContact,
      articleModal, openArticleModal, closeArticleModal,
      brandLogo, setBrandLogo,
      // Multilingual
      lang, setLang, t,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
