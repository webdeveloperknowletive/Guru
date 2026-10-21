'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';

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
  } = useStore();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    pincode: '',
    city: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('Razorpay');
  const [couponInput, setCouponInput] = useState(couponCode || '');
  const [localValidationErr, setLocalValidationErr] = useState('');

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
        style={{
          maxWidth: '840px',
          padding: '0',
          overflow: 'hidden',
        }}
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
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
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
                margin: '0 auto 28px',
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
            <div className="checkout-form-col" style={{ padding: 'clamp(20px, 3.5vw, 28px) clamp(16px, 3vw, 26px)', overflowY: 'auto', maxHeight: '82vh' }}>
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
                    <label style={{ display: 'block', marginBottom: '8px' }}>Payment Method · पेमेंट पर्याय</label>
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
                  ) : (
                    <span>Confirm &amp; Place Order → ₹{serverCart.total_amount ? Number(serverCart.total_amount).toLocaleString('en-IN') : '0'}</span>
                  )}
                </button>
                <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                  🔒 100% Secure Checkout · SSL 256-bit Encrypted
                </p>
              </form>
            </div>

            {/* Right: Order Summary & Authoritative Server Calculation */}
            <div
              className="checkout-summary-col"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                padding: 'clamp(20px, 3.5vw, 28px) clamp(16px, 3vw, 24px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                maxHeight: '82vh',
                overflowY: 'auto',
              }}
            >
              <div>
                <h4 style={{ fontFamily: 'var(--serif)', fontSize: '17px', color: 'var(--cream)', marginBottom: '16px' }}>
                  Order Summary ({cart.reduce((s, it) => s + it.qty, 0)})
                </h4>

                {/* Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  {cart.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '48px 1fr auto',
                        gap: '12px',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        className="thumb"
                        style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', display: 'grid', placeItems: 'center' }}
                        dangerouslySetInnerHTML={{ __html: item.img || '' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h5 style={{ fontSize: '13px', color: 'var(--cream)', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </h5>
                        <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                          Qty: {item.qty} × ₹{Number(item.price).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--gold-lt)' }}>
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
