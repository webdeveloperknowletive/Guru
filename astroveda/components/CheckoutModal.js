'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/context/StoreContext';
import OfflinePaymentBox from '@/components/OfflinePaymentBox';
import ReCaptcha from '@/components/ReCaptcha';

export default function CheckoutModal() {
  const {
    cart,
    serverCart,
    couponCode,
    setCouponCode,
    checkoutOpen,
    checkoutStep,
    checkoutLoading,
    checkoutError,
    lastOrder,
    closeCheckout,
    submitCheckout,
    openTracking,
    paymentMode,
    paymentModeLoading,
    paymentModeError,
    refreshPaymentMode,
    businessWhatsappNumber,
    offlineInstructions,
    offlineQrCode,
  } = useStore();

  const [captchaToken, setCaptchaToken] = useState('');
  const recaptchaRef = useRef(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    pincode: '',
    city: '',
  });

  const [couponInput, setCouponInput] = useState(couponCode || '');
  const [localValidationErr, setLocalValidationErr] = useState('');

  const confirmedScrollRef = useRef(null);

  // Auto-focus the confirmation container for keyboard scrolling and accessibility
  useEffect(() => {
    if (checkoutOpen && checkoutStep === 'confirmed') {
      if (confirmedScrollRef.current) {
        confirmedScrollRef.current.focus({ preventScroll: true });
      }
    }
  }, [checkoutOpen, checkoutStep]);

  // Clean keyboard listener for Escape key to dismiss confirmation or modal
  useEffect(() => {
    if (!checkoutOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !checkoutLoading) {
        closeCheckout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkoutOpen, checkoutLoading, closeCheckout]);

  useEffect(() => {
    if (couponCode) {
      setCouponInput(couponCode);
    }
  }, [couponCode]);

  if (!checkoutOpen) return null;

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setLocalValidationErr('');
  };

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    if (couponInput.trim()) {
      setCouponCode(couponInput.trim().toUpperCase());
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalValidationErr('');

    if (paymentModeLoading) {
      setLocalValidationErr('कृपया पेमेंट मोड लोड होण्याची प्रतीक्षा करा (Checking payment mode, please wait...)');
      return;
    }

    if (!paymentMode || !['online', 'offline'].includes(paymentMode) || paymentModeError) {
      setLocalValidationErr('पेमेंट मोड उपलब्ध नाही. कृपया रीट्राय (Retry) करा किंवा पेज रीलोड करा. (Payment mode unavailable. Please retry.)');
      return;
    }

    if (!form.name.trim()) {
      setLocalValidationErr('कृपया तुमचे पूर्ण नाव प्रविष्ट करा (Please enter your full name)');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setLocalValidationErr('कृपया वैध ईमेल पत्ता प्रविष्ट करा (Please enter a valid email address)');
      return;
    }
    if (!form.phone.trim() || form.phone.replace(/[^\d]/g, '').length < 10) {
      setLocalValidationErr('कृपया वैध 10-अंकी मोबाइल नंबर प्रविष्ट करा (Please enter a valid phone number)');
      return;
    }
    const fullAddress = `${form.address.trim()}, ${form.city ? form.city.trim() + ', ' : ''}${form.pincode ? 'PIN: ' + form.pincode.trim() : ''}`.replace(/^, |, $/g, '');
    if (!form.address.trim()) {
      setLocalValidationErr('कृपया संपूर्ण डिलिव्हरी पत्ता प्रविष्ट करा (Please enter your delivery address)');
      return;
    }

    if (!captchaToken) {
      setLocalValidationErr('Please complete the CAPTCHA verification (कृपया कॅप्चा पूर्ण करा).');
      setTimeout(() => {
        const captchaEl = document.getElementById('recaptcha-checkout');
        if (captchaEl) {
          captchaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    const res = await submitCheckout({
      name: form.name,
      email: form.email,
      phone: form.phone,
      address: fullAddress,
      recaptcha_token: captchaToken,
    });
    if (!res || !res.success) {
      recaptchaRef.current?.reset();
      setCaptchaToken('');
    }
  };

  const renderCheckoutThumb = (item) => {
    const raw = item?.img || (Array.isArray(item?.images) && item.images[0]) || item?.thumbnail || '';
    const src = typeof raw === 'string' ? raw.trim() : '';

    if (src.startsWith('<')) {
      return (
        <div
          className="checkout-item-thumb svg-thumb"
          dangerouslySetInnerHTML={{ __html: src }}
        />
      );
    }

    const initialSrc = src || '/categories/rudraksha.png';

    return (
      <div className="checkout-item-thumb">
        <img
          src={initialSrc}
          alt={item?.title || 'Product'}
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            const current = target.src || '';
            if (current.includes('/static/uploads/products/')) {
              const filename = current.split('/').pop();
              if (filename && !target.getAttribute('data-retried')) {
                target.setAttribute('data-retried', 'true');
                target.src = `/products/${filename}`;
                return;
              }
            }
            target.onerror = null;
            target.src = '/categories/rudraksha.png';
          }}
        />
      </div>
    );
  };

  return (
    <div
      className="pd-modal-overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget && !checkoutLoading) closeCheckout();
      }}
      style={{ zIndex: 1000 }}
    >
      <div
        className={`pd-modal checkout-modal ${checkoutStep === 'confirmed' ? 'confirmed' : ''}`}
      >
        <button
          className="pd-close"
          onClick={closeCheckout}
          aria-label="Close checkout"
          disabled={checkoutLoading}
        >
          ✕
        </button>

        {checkoutStep === 'confirmed' && lastOrder ? (
          /* ================= ORDER CONFIRMATION VIEW ================= */
          <div
            className="checkout-confirmed-col"
            ref={confirmedScrollRef}
            tabIndex={0}
            role="region"
            aria-label="Order Confirmation Details"
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                margin: '0 auto 20px',
                borderRadius: '50%',
                background: 'rgba(224, 176, 74, 0.15)',
                border: '2px solid var(--gold)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '32px',
                color: 'var(--gold-lt)',
              }}
            >
              ✓
            </div>
            <span className="kicker" style={{ color: 'var(--gold-lt)' }}>आदेश यशस्वी · Order Confirmed</span>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: '26px', margin: '8px 0 12px', color: 'var(--cream)' }}>
              धन्यवाद, तुमचा आदेश नोंदवला गेला आहे!
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px' }}>
              Your sacred order has been received and queued for dispatch. You will receive an SMS and WhatsApp confirmation shortly.
            </p>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(224, 176, 74, 0.2)',
                borderRadius: '12px',
                padding: '20px 24px',
                maxWidth: '520px',
                margin: '0 auto 20px',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(224,176,74,0.1)' }}>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Order Number</span>
                <strong style={{ color: 'var(--gold-lt)', fontFamily: 'var(--serif)', fontSize: '16px' }}>
                  {lastOrder.order_number}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(224,176,74,0.1)' }}>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Total Amount</span>
                <strong style={{ color: 'var(--cream)', fontSize: '15px' }}>
                  ₹{Number(lastOrder.total_amount).toLocaleString('en-IN')}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(224,176,74,0.1)' }}>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Payment Status</span>
                <span style={{
                  color: lastOrder.payment_status === 'paid' ? '#10b981' : (lastOrder.payment_status === 'offline_pending' ? '#f59e0b' : 'var(--gold-lt)'),
                  fontWeight: '700',
                  fontSize: '13px'
                }}>
                  {lastOrder.payment_status === 'paid' ? '✓ Paid via Razorpay' : (lastOrder.payment_status === 'offline_pending' ? 'Offline Payment Pending' : (lastOrder.payment_status || 'Pending'))}
                </span>
              </div>
              {lastOrder.transaction_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(224,176,74,0.1)' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Transaction ID</span>
                  <span style={{ color: '#86efac', fontFamily: 'monospace', fontSize: '12px', fontWeight: '600' }}>
                    {lastOrder.transaction_number}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(224,176,74,0.1)' }}>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Payment Method</span>
                <span style={{ color: 'var(--cream)', fontSize: '13.5px' }}>
                  {lastOrder.payment_method}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Estimated Dispatch</span>
                <span style={{ color: 'var(--gold-lt)', fontSize: '13.5px' }}>Within 24 to 48 Hours</span>
              </div>
            </div>

            {(lastOrder.payment_mode === 'offline' || lastOrder.payment_status === 'offline_pending') && (
              <OfflinePaymentBox
                instructions={lastOrder.offline_payment_instructions || offlineInstructions}
                qrCodeUrl={lastOrder.offline_qr_code || offlineQrCode || '/phonepe-qr.jpg'}
                referenceNumber={lastOrder.order_number}
                amount={lastOrder.total_amount}
                customerName={lastOrder.customer_name}
                whatsappUrl={lastOrder.whatsapp_url || `https://wa.me/${(businessWhatsappNumber || '919623117545').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Namaste! I have placed order ${lastOrder.order_number} for ₹${lastOrder.total_amount}. Here is my payment confirmation screenshot:`)}`}
                whatsappButtonText="💬 Share Payment Screenshot on WhatsApp"
                title="Offline Payment Instructions / पेमेंट पद्धत"
              />
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {lastOrder.whatsapp_url && (
                <a
                  href={lastOrder.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{
                    padding: '12px 24px',
                    borderRadius: '99px',
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)',
                  }}
                >
                  💬 Open WhatsApp Chat
                </a>
              )}
              <button
                className="btn btn-gold"
                onClick={() => {
                  closeCheckout();
                  openTracking(lastOrder.order_number, lastOrder.access_token, lastOrder.customer_email);
                }}
                style={{ padding: '12px 24px', borderRadius: '99px' }}
              >
                📦 Track This Order
              </button>
              <button
                className="btn btn-ghost"
                onClick={closeCheckout}
                style={{ padding: '12px 24px', borderRadius: '99px' }}
              >
                Continue Shopping
              </button>
              <a
                href={lastOrder.whatsapp_url || `https://wa.me/${(businessWhatsappNumber || '919623117545').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello Guruji, I have placed order ' + lastOrder.order_number)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
                style={{ padding: '12px 24px', borderRadius: '99px' }}
              >
                📲 WhatsApp Updates
              </a>
            </div>
          </div>
        ) : (
          /* ================= ACTIVE CHECKOUT WORKFLOW ================= */
          <>
            {/* Left: Devotee & Shipping Form */}
            <div className="checkout-form-col">
              <div style={{ marginBottom: '20px' }}>
                <span className="kicker">Secure Checkout</span>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: '22px', color: 'var(--cream)', margin: '4px 0 6px' }}>
                  Devotee &amp; Shipping Details
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: '12.5px', margin: 0 }}>
                  डिलिव्हरीसाठी आवश्यक माहिती भरा — सुरक्षित आणि जलद डिस्पॅच.
                </p>
              </div>

              {(localValidationErr || checkoutError) && (
                <div
                  style={{
                    background: 'rgba(255, 95, 138, 0.12)',
                    border: '1px solid rgba(255, 95, 138, 0.4)',
                    color: '#ff8da9',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    marginBottom: '16px',
                  }}
                >
                  ⚠️ {localValidationErr || checkoutError}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-grid" style={{ gap: '14px' }}>
                  <div className="field full">
                    <label htmlFor="chk-name">Full Name · पूर्ण नाव *</label>
                    <input
                      type="text"
                      id="chk-name"
                      name="name"
                      value={form.name}
                      onChange={handleFieldChange}
                      placeholder="e.g. Rahul Sharma"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="chk-email">Email Address *</label>
                    <input
                      type="email"
                      id="chk-email"
                      name="email"
                      value={form.email}
                      onChange={handleFieldChange}
                      placeholder="devotee@example.com"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="chk-phone">Mobile / WhatsApp Number *</label>
                    <input
                      type="tel"
                      id="chk-phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleFieldChange}
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>

                  <div className="field full">
                    <label htmlFor="chk-address">Shipping Address · पत्ता *</label>
                    <textarea
                      id="chk-address"
                      name="address"
                      value={form.address}
                      onChange={handleFieldChange}
                      placeholder="House / Flat No., Society, Landmark, Street"
                      rows={2}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="chk-city">City / Town · शहर</label>
                    <input
                      type="text"
                      id="chk-city"
                      name="city"
                      value={form.city}
                      onChange={handleFieldChange}
                      placeholder="Pune, Mumbai, etc."
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="chk-pin">Pincode · पिनकोड</label>
                    <input
                      type="text"
                      id="chk-pin"
                      name="pincode"
                      value={form.pincode}
                      onChange={handleFieldChange}
                      placeholder="e.g. 411001"
                      maxLength={6}
                    />
                  </div>

                  <div className="field full" style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ margin: 0 }}>Payment Method · पेमेंट पर्याय</label>
                      {paymentMode === 'offline' && (
                        <span style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                          Offline Mode Active
                        </span>
                      )}
                      {paymentMode === 'online' && (
                        <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                          Online Mode Active
                        </span>
                      )}
                    </div>

                    {paymentModeLoading ? (
                      <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(224,176,74,0.15)', color: 'var(--muted)', fontSize: '12.5px', textAlign: 'center' }}>
                        ⏳ Checking storefront payment configuration...
                      </div>
                    ) : paymentModeError || !paymentMode || !['online', 'offline'].includes(paymentMode) ? (
                      <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255, 95, 138, 0.1)', border: '1px solid rgba(255, 95, 138, 0.3)', color: '#ff8da9', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>⚠️ {paymentModeError || 'Payment configuration could not be loaded.'}</span>
                          <button
                            type="button"
                            onClick={refreshPaymentMode}
                            className="btn btn-ghost"
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            🔄 Retry
                          </button>
                        </div>
                      </div>
                    ) : paymentMode === 'offline' ? (
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: '1px solid #25D366',
                            background: 'rgba(37, 211, 102, 0.08)',
                            fontSize: '13px',
                            color: 'var(--cream)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>💬</span>
                            <div>
                              <div style={{ fontWeight: '700', color: '#86efac' }}>
                                WhatsApp Checkout (Offline Mode)
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                                Direct devotee order verification &amp; offline transfer
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', color: '#86efac', fontWeight: '700' }}>
                            ✓ WhatsApp Order
                          </span>
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>
                          ℹ️ No online card gateway required. Order details will be sent directly to official WhatsApp ({businessWhatsappNumber ? `+${businessWhatsappNumber}` : '+91 96231 17545'}) with pending confirmation status.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--gold)',
                            background: 'rgba(224, 176, 74, 0.08)',
                            fontSize: '13px',
                            color: 'var(--cream)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>💳</span>
                            <div>
                              <div style={{ fontWeight: '700', color: 'var(--gold-lt)' }}>
                                Razorpay Secure Payment
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                                UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Net Banking
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--gold-lt)', fontWeight: '700' }}>
                            ✓ 100% Encrypted
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '12px', marginBottom: '4px' }}>
                  <ReCaptcha
                    id="recaptcha-checkout"
                    ref={recaptchaRef}
                    onChange={setCaptchaToken}
                    onExpired={() => setCaptchaToken('')}
                    onError={() => setCaptchaToken('')}
                  />
                </div>

                <button
                  type="submit"
                  className={paymentMode === 'offline' ? 'btn' : 'btn btn-gold'}
                  disabled={
                    checkoutLoading ||
                    cart.length === 0 ||
                    paymentModeLoading ||
                    !paymentMode ||
                    !['online', 'offline'].includes(paymentMode) ||
                    !!paymentModeError
                  }
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '14px 22px',
                    fontSize: '14px',
                    fontWeight: '700',
                    letterSpacing: '0.06em',
                    borderRadius: '99px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: paymentMode === 'offline'
                      ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)'
                      : undefined,
                    color: paymentMode === 'offline' ? '#ffffff' : undefined,
                    border: 'none',
                    cursor: (checkoutLoading || cart.length === 0 || paymentModeLoading || !paymentMode || !!paymentModeError) ? 'not-allowed' : 'pointer',
                    boxShadow: paymentMode === 'offline' ? '0 4px 14px rgba(37, 211, 102, 0.35)' : undefined,
                  }}
                >
                  {checkoutLoading ? (
                    <span>Processing Sacred Order...</span>
                  ) : paymentModeLoading ? (
                    <span>Loading Checkout Mode...</span>
                  ) : paymentModeError || !paymentMode || !['online', 'offline'].includes(paymentMode) ? (
                    <span>⚠️ Checkout Mode Unavailable</span>
                  ) : paymentMode === 'offline' ? (
                    <span>💬 Order via WhatsApp / व्हॉट्सॲपवर ऑर्डर करा → ₹{serverCart.total_amount ? Number(serverCart.total_amount).toLocaleString('en-IN') : '0'}</span>
                  ) : (
                    <span>💳 Pay with Razorpay / ऑनलाइन पे करा → ₹{serverCart.total_amount ? Number(serverCart.total_amount).toLocaleString('en-IN') : '0'}</span>
                  )}
                </button>
                <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                  🔒 100% Secure Checkout · SSL 256-bit Encrypted
                </p>
              </form>
            </div>

            {/* Right: Order Summary & Authoritative Server Calculation */}
            <div className="checkout-summary-col">
              <div>
                <div className="checkout-summary-head">
                  <h4>Order Summary ({cart.reduce((s, it) => s + it.qty, 0)})</h4>
                </div>

                {/* Items List */}
                <div className="checkout-items-list">
                  {cart.map((item, idx) => (
                    <div key={item.id ? `${item.id}-${idx}` : idx} className="checkout-item-row">
                      {renderCheckoutThumb(item)}
                      <div className="checkout-item-info">
                        <h5 className="checkout-item-title" title={item.title}>
                          {item.title}
                        </h5>
                        <span className="checkout-item-meta">
                          Qty: <strong>{item.qty}</strong> × ₹{Number(item.price).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className="checkout-item-price">
                        ₹{(Number(item.price) * item.qty).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Coupon Box */}
                <div style={{ borderTop: '1px solid rgba(224,176,74,0.1)', paddingTop: '16px', marginBottom: '18px' }}>
                  <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Coupon (e.g. DIWALI108)"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(224,176,74,0.2)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        color: 'var(--cream)',
                        fontSize: '12px',
                        textTransform: 'uppercase',
                      }}
                    />
                    <button
                      type="submit"
                      className="btn btn-ghost"
                      style={{ padding: '8px 14px', fontSize: '12px' }}
                    >
                      Apply
                    </button>
                  </form>
                    {serverCart.coupon_applied && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: 'var(--gold-lt)' }}>
                        <span>✓ Coupon &apos;{serverCart.coupon_applied.code}&apos; applied</span>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          style={{ background: 'none', border: 'none', color: '#ff8da9', cursor: 'pointer', fontSize: '11px' }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {serverCart.error && couponCode && !serverCart.coupon_applied && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: '#ff8da9', lineHeight: '1.4' }}>
                        <span>⚠ {serverCart.error}</span>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                </div>

                {/* Calculation Breakdown */}
                <div style={{ borderTop: '1px solid rgba(224,176,74,0.1)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)' }}>
                    <span>Subtotal</span>
                    <span style={{ color: 'var(--cream)' }}>₹{Number(serverCart.subtotal || 0).toLocaleString('en-IN')}</span>
                  </div>

                  {serverCart.discount_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--gold-lt)' }}>
                      <span>Coupon Discount</span>
                      <span>−₹{Number(serverCart.discount_amount).toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)' }}>
                    <span>Vedic Goods GST (3%)</span>
                    <span style={{ color: 'var(--cream)' }}>₹{Number(serverCart.tax_amount || 0).toLocaleString('en-IN')}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)' }}>
                    <span>Shipping</span>
                    <span style={{ color: serverCart.shipping_amount === 0 ? 'var(--gold-lt)' : 'var(--cream)' }}>
                      {serverCart.shipping_amount === 0 ? 'FREE (Orders > ₹999)' : `₹${serverCart.shipping_amount}`}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      borderTop: '1px solid rgba(224,176,74,0.2)',
                      paddingTop: '12px',
                      marginTop: '6px',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--serif)', fontSize: '15px', color: 'var(--cream)', fontWeight: '600' }}>
                      Total Amount
                    </span>
                    <strong style={{ fontFamily: 'var(--serif)', fontSize: '20px', color: 'var(--gold-lt)' }}>
                      ₹{Number(serverCart.total_amount || 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: 'rgba(224,176,74,0.06)', border: '1px solid rgba(224,176,74,0.1)' }}>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  🌿 सर्व वस्तू शास्त्रोक्त पद्धतीने अभिमंत्रित करून वाराणसी/हरिद्वार आश्रमातून पाठवल्या जातात. 7-दिवसीय Easy Return Guarantee.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
