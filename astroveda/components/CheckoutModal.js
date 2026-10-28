'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/context/StoreContext';
import OfflinePaymentBox from '@/components/OfflinePaymentBox';

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
    offlineInstructions,
    offlineQrCode,
  } = useStore();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    pincode: '',
    city: '',
  });

  const [paymentMethod, setPaymentMethod] = useState(paymentMode === 'offline' ? 'Offline / Direct UPI / Bank Transfer' : 'Razorpay');
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
    if (paymentMode === 'offline') {
      setPaymentMethod('Offline / Direct UPI / Bank Transfer');
    } else {
      setPaymentMethod('Razorpay');
    }
  }, [paymentMode]);

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

    await submitCheckout(
      {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: fullAddress,
      },
      paymentMethod
    );
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
                whatsappUrl={`https://wa.me/919623117545?text=${encodeURIComponent(`Namaste! I have placed an order (${lastOrder.order_number}) for ₹${lastOrder.total_amount}. Here is my payment confirmation screenshot:`)}`}
                whatsappButtonText="💬 Share Payment Screenshot on WhatsApp"
                title="Offline Payment Instructions / पेमेंट पद्धत"
              />
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
                href={`https://wa.me/919000000000?text=${encodeURIComponent('Hello Guruji, I have placed order ' + lastOrder.order_number)}`}
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
                        <span style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                          Offline Mode Active
                        </span>
                      )}
                    </div>

                    {paymentMode === 'offline' ? (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 14px',
                              borderRadius: '8px',
                              border: paymentMethod === 'Offline / Direct UPI / Bank Transfer' ? '1px solid var(--gold)' : '1px solid rgba(224,176,74,0.15)',
                              background: paymentMethod === 'Offline / Direct UPI / Bank Transfer' ? 'rgba(224,176,74,0.08)' : 'rgba(255,255,255,0.02)',
                              cursor: 'pointer',
                              fontSize: '12.5px',
                              color: 'var(--cream)',
                            }}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="Offline / Direct UPI / Bank Transfer"
                              checked={paymentMethod === 'Offline / Direct UPI / Bank Transfer'}
                              onChange={() => setPaymentMethod('Offline / Direct UPI / Bank Transfer')}
                            />
                            <span>🏦 UPI / Bank Transfer</span>
                          </label>

                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 14px',
                              borderRadius: '8px',
                              border: paymentMethod === 'Cash on Delivery' ? '1px solid var(--gold)' : '1px solid rgba(224,176,74,0.15)',
                              background: paymentMethod === 'Cash on Delivery' ? 'rgba(224,176,74,0.08)' : 'rgba(255,255,255,0.02)',
                              cursor: 'pointer',
                              fontSize: '12.5px',
                              color: 'var(--cream)',
                            }}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="Cash on Delivery"
                              checked={paymentMethod === 'Cash on Delivery'}
                              onChange={() => setPaymentMethod('Cash on Delivery')}
                            />
                            <span>💵 Pay on Delivery</span>
                          </label>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>
                          ℹ️ No online card gateway required. Order is saved with pending status; follow offline transfer instructions upon confirmation.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: paymentMethod === 'Razorpay' ? '1px solid var(--gold)' : '1px solid rgba(224,176,74,0.15)',
                            background: paymentMethod === 'Razorpay' ? 'rgba(224,176,74,0.08)' : 'rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: 'var(--cream)',
                          }}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="Razorpay"
                            checked={paymentMethod === 'Razorpay'}
                            onChange={() => setPaymentMethod('Razorpay')}
                          />
                          <span>💳 Razorpay / UPI</span>
                        </label>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: paymentMethod === 'Cash on Delivery' ? '1px solid var(--gold)' : '1px solid rgba(224,176,74,0.15)',
                            background: paymentMethod === 'Cash on Delivery' ? 'rgba(224,176,74,0.08)' : 'rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: 'var(--cream)',
                          }}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="Cash on Delivery"
                            checked={paymentMethod === 'Cash on Delivery'}
                            onChange={() => setPaymentMethod('Cash on Delivery')}
                          />
                          <span>💵 Pay on Delivery</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-gold"
                  disabled={checkoutLoading || cart.length === 0}
                  style={{
                    width: '100%',
                    marginTop: '24px',
                    padding: '14px 22px',
                    fontSize: '14px',
                    fontWeight: '700',
                    letterSpacing: '0.06em',
                    borderRadius: '99px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {checkoutLoading ? (
                    <span>Processing Sacred Order...</span>
                  ) : paymentMode === 'offline' ? (
                    <span>Confirm &amp; Place Order (Offline Payment) → ₹{serverCart.total_amount ? Number(serverCart.total_amount).toLocaleString('en-IN') : '0'}</span>
                  ) : paymentMethod === 'Cash on Delivery' ? (
                    <span>Confirm Order (Pay on Delivery) → ₹{serverCart.total_amount ? Number(serverCart.total_amount).toLocaleString('en-IN') : '0'}</span>
                  ) : (
                    <span>Pay with Razorpay / ऑनलाइन पे करा → ₹{serverCart.total_amount ? Number(serverCart.total_amount).toLocaleString('en-IN') : '0'}</span>
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
