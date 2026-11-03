'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { findProduct, getAllProducts } from '@/lib/products';
import { calculateCart, checkoutOrder, createRazorpayOrder, verifyPayment, recordPaymentFailure, getPaymentMode, getCheckoutConfig } from '@/lib/api';
import { getTranslation } from '@/lib/translations';
import { recordEvent } from '@/lib/analytics';

export function loadRazorpayScript() {
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

  // Store payment mode: 'online' or 'offline' (null until authoritatively loaded)
  const [paymentMode, setPaymentMode] = useState(null);
  const [paymentModeLoading, setPaymentModeLoading] = useState(true);
  const [paymentModeError, setPaymentModeError] = useState(null);
  const [businessWhatsappNumber, setBusinessWhatsappNumber] = useState(
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919623117545'
  );
  const [offlineInstructions, setOfflineInstructions] = useState('');
  const [offlineQrCode, setOfflineQrCode] = useState('/phonepe-qr.jpg');

  // Authoritatively fetch store payment mode from backend
  const refreshPaymentMode = useCallback(async () => {
    try {
      setPaymentModeLoading(true);
      const res = await getPaymentMode();
      if (res && (res.payment_mode === 'online' || res.payment_mode === 'offline')) {
        setPaymentMode(res.payment_mode);
        if (res.offline_payment_instructions) setOfflineInstructions(res.offline_payment_instructions);
        if (res.offline_qr_code) setOfflineQrCode(res.offline_qr_code);
        if (res.whatsapp_number) setBusinessWhatsappNumber(res.whatsapp_number);
        setPaymentModeError(null);
      } else {
        setPaymentMode(null);
        setPaymentModeError('Invalid payment mode configuration received from server');
      }
    } catch (err) {
      setPaymentMode(null);
      setPaymentModeError('Unable to load payment configuration. Please reload the page.');
    } finally {
      setPaymentModeLoading(false);
    }
  }, []);

  // Authoritative Dynamic Checkout Form Configuration
  const [checkoutConfig, setCheckoutConfig] = useState(null);
  const [checkoutConfigLoading, setCheckoutConfigLoading] = useState(true);

  const refreshCheckoutConfig = useCallback(async () => {
    try {
      setCheckoutConfigLoading(true);
      const res = await getCheckoutConfig();
      if (res && res.success && res.config) {
        setCheckoutConfig(res.config);
      }
    } catch (err) {
      console.warn('Could not load dynamic checkout config, using defaults:', err);
    } finally {
      setCheckoutConfigLoading(false);
    }
  }, []);

  // Fetch store payment mode and dynamic checkout configuration on mount
  useEffect(() => {
    let isMounted = true;
    refreshPaymentMode();
    refreshCheckoutConfig();
    const interval = setInterval(() => {
      if (isMounted) {
        refreshPaymentMode();
        refreshCheckoutConfig();
      }
    }, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshPaymentMode, refreshCheckoutConfig]);

  const cartLoadedRef = useRef(false);

  // Restore saved cart and wishlist on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('astroveda_cart_v2');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCart(parsed);
        }
      }
      const savedWish = localStorage.getItem('astroveda_wishlist_v2');
      if (savedWish) {
        const parsed = JSON.parse(savedWish);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWishlist(parsed);
        }
      }
    } catch (e) {
      console.warn('Error restoring state from storage:', e);
    } finally {
      cartLoadedRef.current = true;
    }
  }, []);

  // Sync cart to localStorage only after initial restoration
  useEffect(() => {
    if (!cartLoadedRef.current) return;
    try {
      localStorage.setItem('astroveda_cart_v2', JSON.stringify(cart));
    } catch (e) {
      console.warn('Error storing cart:', e);
    }
  }, [cart]);

  // Sync wishlist to localStorage only after initial restoration
  useEffect(() => {
    if (!cartLoadedRef.current) return;
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

      const sumCfg = checkoutConfig?.order_summary || {};
      const isTaxActive = sumCfg.show_tax_row !== false;
      const isShippingActive = sumCfg.show_shipping_row !== false;
      const gstPct = typeof sumCfg.gst_percentage !== 'undefined' ? Number(sumCfg.gst_percentage) : 3;
      const freeThresh = typeof sumCfg.free_shipping_threshold !== 'undefined' ? Number(sumCfg.free_shipping_threshold) : 999;
      const stdShipping = typeof sumCfg.shipping_charge !== 'undefined' ? Number(sumCfg.shipping_charge) : 99;

      try {
        const res = await calculateCart(payloadItems, couponCode);
        if (!isCancelled) {
          const sub = Number(res.subtotal) || 0;
          const disc = Number(res.discount_amount) || 0;
          const taxable = Math.max(0, sub - disc);
          const tax = isTaxActive ? (typeof res.tax_amount !== 'undefined' ? Number(res.tax_amount) : Math.round(taxable * (gstPct / 100) * 100) / 100) : 0;
          let ship = 0;
          if (isShippingActive) {
            ship = typeof res.shipping_amount !== 'undefined' ? Number(res.shipping_amount) : (taxable >= freeThresh ? 0 : stdShipping);
          }
          const tot = taxable + tax + ship;

          setServerCart({
            subtotal: sub,
            discount_amount: disc,
            coupon_applied: res.coupon_applied || null,
            tax_amount: tax,
            shipping_amount: ship,
            total_amount: tot,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!isCancelled) {
          // Graceful client fallback dynamically matching Checkout Form Builder settings
          const clientSubtotal = cart.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
          const clientTax = isTaxActive ? Math.round(clientSubtotal * (gstPct / 100) * 100) / 100 : 0;
          const clientShipping = isShippingActive ? (clientSubtotal >= freeThresh ? 0 : stdShipping) : 0;
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
  }, [cart, couponCode, checkoutConfig]);

  const showToast = useCallback((msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 2200);
  }, []);

  /**
   * Add product by canonical backend ID or title
   */
  const addToCart = useCallback((productOrTitle, rawPrice) => {
    console.log('ADDTOCART_CALLED', productOrTitle);
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

    // Synchronize browser URL with canonical product slug without full page reload
    if (typeof window !== 'undefined' && prod?.slug) {
      const currentPath = window.location.pathname;
      if (currentPath === '/' || currentPath === '') {
        try {
          window.history.pushState({ isProductModal: true, slug: prod.slug }, '', `/product/${encodeURIComponent(prod.slug)}`);
        } catch {}
      }
    }
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

    // Revert browser URL to root if closed from modal state
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/product/')) {
      try {
        if (window.history.state?.isProductModal) {
          window.history.back();
        } else {
          window.history.pushState(null, '', '/');
        }
      } catch {
        window.history.pushState(null, '', '/');
      }
    }
  }, []);

  // Handle browser back and forward navigation for product modal
  useEffect(() => {
    const handlePopState = () => {
      if (productModal.show) {
        setProductModal({ show: false, product: null, title: null });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [productModal.show]);

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
    refreshPaymentMode();
    refreshCheckoutConfig();
  }, [refreshPaymentMode, refreshCheckoutConfig]);

  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false);
  }, []);

  const submitCheckout = useCallback(async (customerData) => {
    if (cart.length === 0) {
      setCheckoutError('Your cart is empty');
      return { success: false, error: 'Cart is empty' };
    }

    if (!paymentMode || !['online', 'offline'].includes(paymentMode) || paymentModeLoading || paymentModeError) {
      const err = 'Storefront payment mode is unresolved. Please wait or reload the page.';
      setCheckoutError(err);
      return { success: false, error: err };
    }

    setCheckoutLoading(true);
    setCheckoutError(null);

    // Generate random client-side idempotency key for network resilience
    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Support both Razorpay Online and Cash on Delivery (COD)
    const isOffline = paymentMode === 'offline';
    const effectivePaymentMethod = isOffline
      ? 'WhatsApp Order'
      : (customerData.payment_method === 'COD' ? 'COD' : 'Razorpay');

    const payload = {
      customer_name: (customerData.name || '').trim(),
      customer_email: (customerData.email || '').trim(),
      customer_phone: (customerData.phone || '').trim(),
      shipping_address: (customerData.address || '').trim(),
      city: (customerData.city || '').trim(),
      pincode: (customerData.pincode || '').trim(),
      custom_fields: customerData.custom_fields || {},
      payment_method: effectivePaymentMethod,
      payment_mode: isOffline ? 'offline' : 'online',
      policy_accepted: customerData.policy_accepted !== false,
      policy_version: customerData.policy_version || 'v1.0-2026',
      coupon_code: couponCode.trim(),
      recaptcha_token: customerData.recaptcha_token || null,
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

      // Cash on Delivery (COD) direct order placement
      if (effectivePaymentMethod === 'COD' || result.payment_method === 'COD' || result.cod_status === 'cod_pending' || result.payment_status === 'cod_pending') {
        const codOrder = {
          ...result,
          payment_mode: 'online',
          payment_status: 'cod_pending',
          cod_status: 'cod_pending',
          order_status: 'pending',
          payment_method: 'COD',
          customer_name: customerData.name.trim(),
          customer_email: customerData.email.trim(),
          customer_phone: customerData.phone.trim(),
          shipping_address: customerData.address.trim(),
        };
        setLastOrder(codOrder);
        setCheckoutStep('confirmed');
        clearCart();
        setCheckoutLoading(false);
        return { success: true, order: codOrder };
      }

      // Offline mode: WhatsApp order registered as offline_pending
      if (isOffline || result.offline_payment || result.payment_status === 'offline_pending') {
        const cleanWa = (businessWhatsappNumber || '919623117545').replace(/[^0-9]/g, '');

        const waMsgLines = [
          '🕉️ *Swami Guruji — नवीन ऑर्डर (New Sacred Order)*',
          '━━━━━━━━━━━━━━━━━━━━━',
          `📋 *Order ID / संदर्भ क्रमांक:* ${result.order_number || 'Pending'}`,
          `👤 *Devotee / ग्राहक:* ${customerData.name.trim()}`,
          `📱 *Mobile:* ${customerData.phone.trim()}`,
        ];
        if (customerData.email && customerData.email.trim()) {
          waMsgLines.push(`✉️ *Email:* ${customerData.email.trim()}`);
        }
        waMsgLines.push(`📍 *Delivery Address:* ${customerData.address.trim()}`);
        waMsgLines.push('━━━━━━━━━━━━━━━━━━━━━');
        waMsgLines.push('📦 *निवडलेली उत्पादने (Order Items):*');

        cart.forEach((it, idx) => {
          const qty = it.qty || 1;
          const price = Number(it.price || 0);
          waMsgLines.push(`${idx + 1}. ${it.title || it.name} × ${qty} — ₹${(price * qty).toLocaleString('en-IN')}`);
        });

        waMsgLines.push('━━━━━━━━━━━━━━━━━━━━━');
        waMsgLines.push('💰 *पेमेंट तपशील (Order Summary):*');
        waMsgLines.push(`Subtotal: ₹${Number(serverCart.subtotal || 0).toLocaleString('en-IN')}`);
        if (serverCart.discount_amount > 0) {
          waMsgLines.push(`Coupon Discount: -₹${Number(serverCart.discount_amount).toLocaleString('en-IN')}`);
        }
        if (serverCart.tax_amount > 0) {
          const sumCfg = checkoutConfig?.order_summary || {};
          const gstPct = typeof sumCfg.gst_percentage !== 'undefined' ? sumCfg.gst_percentage : 3;
          waMsgLines.push(`GST (${gstPct}%): ₹${Number(serverCart.tax_amount).toLocaleString('en-IN')}`);
        }
        if (checkoutConfig?.order_summary?.show_shipping_row !== false) {
          waMsgLines.push(`Shipping: ${serverCart.shipping_amount === 0 ? 'FREE' : `₹${serverCart.shipping_amount}`}`);
        }
        waMsgLines.push(`*Total Amount: ₹${Number(serverCart.total_amount || result.total_amount || 0).toLocaleString('en-IN')}*`);
        waMsgLines.push('━━━━━━━━━━━━━━━━━━━━━');
        waMsgLines.push('💳 *Payment Status:* Offline Payment Pending');
        waMsgLines.push('🙏 *नमस्ते! मी वरील ऑर्डर नोंदवली आहे. कृपया पेमेंट पुष्टीकरण आणि डिस्पॅच संदर्भात माहिती द्यावी.*');

        const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(waMsgLines.join('\n'))}`;

        if (typeof window !== 'undefined') {
          try {
            window.open(waUrl, '_blank');
          } catch (e) {
            console.warn('Could not auto-open WhatsApp:', e);
          }
        }

        const offlineOrder = {
          ...result,
          payment_mode: 'offline',
          payment_status: 'offline_pending',
          order_status: 'pending',
          payment_method: 'WhatsApp Order',
          customer_name: customerData.name.trim(),
          customer_email: customerData.email.trim(),
          customer_phone: customerData.phone.trim(),
          shipping_address: customerData.address.trim(),
          whatsapp_url: waUrl,
        };
        setLastOrder(offlineOrder);
        setCheckoutStep('confirmed');
        clearCart();
        setCheckoutLoading(false);
        return { success: true, order: offlineOrder, whatsapp_url: waUrl };
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
          name: 'Swami Guruji',
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
  }, [cart, serverCart, couponCode, clearCart, paymentMode, paymentModeLoading, paymentModeError, businessWhatsappNumber]);

  const cartCount = cart.reduce((s, it) => s + it.qty, 0);
  const cartSubtotal = cart.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
  const isInWishlist = (titleOrId) => wishlist.some(it => it.id === titleOrId || it.title === titleOrId);

  // Expose store handle on window cleanly after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__astroveda = {
        addToCart,
        openCheckout,
        closeCheckout,
        setCart,
        refreshCheckoutConfig,
        getCart: () => cart,
        getConfig: () => checkoutConfig
      };
      window.openCheckout = openCheckout;
    }
  }, [addToCart, openCheckout, closeCheckout, setCart, refreshCheckoutConfig, cart, checkoutConfig]);

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
      checkoutConfig, checkoutConfigLoading, refreshCheckoutConfig,
      // Payment Mode
      paymentMode, setPaymentMode, paymentModeLoading, paymentModeError, refreshPaymentMode, businessWhatsappNumber, offlineInstructions, offlineQrCode,
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
