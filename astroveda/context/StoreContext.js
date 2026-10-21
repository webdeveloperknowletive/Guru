'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { findProduct, getAllProducts } from '@/lib/products';
import { calculateCart, checkoutOrder } from '@/lib/api';

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

    const title = canonical ? canonical.title : String(productOrTitle);
    const id = canonical ? canonical.id : 3; // fallback to 5 Mukhi Mala ID
    const price = canonical ? canonical.priceNum : (parseInt(String(rawPrice).replace(/[^\d]/g, ''), 10) || 0);
    const img = canonical ? canonical.img : '';
    const sku = canonical ? canonical.sku : 'RM-005';
    const slug = canonical ? canonical.slug : 'product';

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
  }, [showToast]);

  const removeFromCart = useCallback((idOrIndex) => {
    setCart(prev => prev.filter((it, i) => (typeof idOrIndex === 'number' && idOrIndex >= 0 && idOrIndex < prev.length && i !== idOrIndex) ? false : it.id !== idOrIndex));
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

    const title = canonical ? canonical.title : String(productOrTitle);
    const id = canonical ? canonical.id : 3;
    const price = canonical ? canonical.priceNum : (parseInt(String(rawPrice).replace(/[^\d]/g, ''), 10) || 0);
    const img = canonical ? canonical.img : '';

    setWishlist(prev => {
      const idx = prev.findIndex(it => it.id === id || it.title === title);
      if (idx === -1) {
        showToast(`${title} — wishlist मध्ये जोडले`);
        return [...prev, { id, title, price, img }];
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
    setWishlist(prev => {
      const item = typeof indexOrId === 'number' ? prev[indexOrId] : prev.find(it => it.id === indexOrId);
      if (!item) return prev;
      addToCart(item, item.price);
      return prev.filter((it, i) => (typeof indexOrId === 'number' ? i !== indexOrId : it.id !== indexOrId));
    });
  }, [addToCart]);

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

  const openProductModal = useCallback((titleOrProduct) => {
    let prod = null;
    let titleStr = '';
    if (typeof titleOrProduct === 'object' && titleOrProduct !== null) {
      prod = titleOrProduct;
      titleStr = titleOrProduct.title || titleOrProduct.name;
    } else {
      prod = findProduct(titleOrProduct);
      titleStr = prod ? prod.title : String(titleOrProduct);
    }
    setProductModal({ show: true, product: prod, title: titleStr });
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

    const payload = {
      customer_name: customerData.name.trim(),
      customer_email: customerData.email.trim(),
      customer_phone: customerData.phone.trim(),
      shipping_address: customerData.address.trim(),
      payment_method: paymentMethod,
      coupon_code: couponCode.trim(),
      items: cart.map(item => ({
        product_id: item.id,
        quantity: item.qty,
      })),
    };

    try {
      const result = await checkoutOrder(payload, idempotencyKey);
      setLastOrder(result);
      setCheckoutStep('confirmed');
      clearCart();

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

      setCheckoutLoading(false);
      return { success: true, order: result };
    } catch (err) {
      setCheckoutError(err.message || 'Failed to place order. Please verify your details.');
      setCheckoutLoading(false);
      return { success: false, error: err.message };
    }
  }, [cart, couponCode, clearCart]);

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
      // Connected Modals & Workflows
      trackingModal, openTracking, closeTracking,
      contactModal, openContact, closeContact,
      articleModal, openArticleModal, closeArticleModal,
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
