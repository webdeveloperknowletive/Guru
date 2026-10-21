'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { getOrderTracking, cancelOrder, returnOrder } from '@/lib/api';

export default function OrderTrackingModal() {
  const { trackingModal, closeTracking, showToast } = useStore();
  const { show, orderNumber: initialOrderNumber, token: initialToken, email: initialEmail } = trackingModal;

  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Return / Cancel state
  const [returnReason, setReturnReason] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (show) {
      const num = initialOrderNumber || '';
      const em = initialEmail || '';
      setOrderNumberInput(num);
      setEmailInput(em);
      setError(null);
      setShowReturnForm(false);
      setReturnReason('');

      if (num) {
        // Auto-lookup if order number was passed
        lookupOrder(num, initialToken || '', em);
      } else {
        setOrderData(null);
      }
    }
  }, [show, initialOrderNumber, initialToken, initialEmail]);

  if (!show) return null;

  const lookupOrder = async (num, tok = '', em = '') => {
    const cleanNum = (num || orderNumberInput).trim();
    if (!cleanNum) {
      setError('Please enter your Order Number (e.g., #ORD1086 or ORD1086)');
      return;
    }

    setLoading(true);
    setError(null);

    // Retrieve token from localStorage if not passed
    let tokenToUse = tok;
    if (!tokenToUse && typeof window !== 'undefined') {
      try {
        const storedTokens = JSON.parse(localStorage.getItem('astroveda_order_tokens') || '{}');
        tokenToUse = storedTokens[cleanNum] || storedTokens[cleanNum.replace(/^#/, '')] || storedTokens[`#${cleanNum}`] || '';
      } catch (e) {
        console.warn('Could not read stored order tokens:', e);
      }
    }

    const emailToUse = em || emailInput.trim();

    try {
      const res = await getOrderTracking(cleanNum, tokenToUse, emailToUse);
      setOrderData(res);
      setError(null);
    } catch (err) {
      setOrderData(null);
      setError(err.message || 'Order not found. Please verify your order number and email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    lookupOrder(orderNumberInput, '', emailInput);
  };

  const handleCancelOrder = async () => {
    if (!orderData) return;
    if (!window.confirm(`Are you sure you want to cancel order ${orderData.order_number}?`)) return;

    setActionLoading(true);
    try {
      let tokenToUse = initialToken || '';
      if (!tokenToUse && typeof window !== 'undefined') {
        const storedTokens = JSON.parse(localStorage.getItem('astroveda_order_tokens') || '{}');
        tokenToUse = storedTokens[orderData.order_number] || '';
      }
      const res = await cancelOrder(orderData.order_number, tokenToUse, orderData.customer_email);
      showToast(res.message || 'Order cancelled successfully');
      // Refresh order view
      lookupOrder(orderData.order_number, tokenToUse, orderData.customer_email);
    } catch (err) {
      showToast(err.message || 'Could not cancel order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnReason.trim()) {
      showToast('Please state a reason for the return');
      return;
    }

    setActionLoading(true);
    try {
      let tokenToUse = initialToken || '';
      if (!tokenToUse && typeof window !== 'undefined') {
        const storedTokens = JSON.parse(localStorage.getItem('astroveda_order_tokens') || '{}');
        tokenToUse = storedTokens[orderData.order_number] || '';
      }
      const res = await returnOrder(orderData.order_number, returnReason.trim(), tokenToUse, orderData.customer_email);
      showToast(res.message || 'Return request submitted successfully');
      setShowReturnForm(false);
      setReturnReason('');
      lookupOrder(orderData.order_number, tokenToUse, orderData.customer_email);
    } catch (err) {
      showToast(err.message || 'Could not submit return request');
    } finally {
      setActionLoading(false);
    }
  };

  const statusColors = {
    pending: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.35)', label: 'Order Confirmed · विधी संकल्प सुरू' },
    processing: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.35)', label: 'Energising & Preparing · प्राणप्रतिष्ठा विधी' },
    shipped: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.35)', label: 'Dispatched · मार्गस्थ' },
    delivered: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.35)', label: 'Delivered · प्राप्त झाले' },
    cancelled: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.35)', label: 'Cancelled · रद्द' },
  };

  const currentStatus = orderData ? (statusColors[orderData.order_status] || statusColors.pending) : null;

  return (
    <div
      className="pd-modal-overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && !actionLoading) closeTracking();
      }}
      style={{ zIndex: 1050 }}
    >
      <div
        className="pd-modal"
        style={{
          maxWidth: '680px',
          display: 'block',
          padding: 'clamp(18px, 4vw, 32px)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          className="pd-close"
          onClick={closeTracking}
          aria-label="Close tracking"
          disabled={loading || actionLoading}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span className="kicker" style={{ display: 'inline-block', marginBottom: '6px' }}>Order Tracking</span>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: '24px', color: 'var(--gold-lt)' }}>
            Track Your Sacred Order
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            तुमच्या ऑर्डर्सची स्थिती व प्राणप्रतिष्ठा विधी प्रगती जाणून घ्या
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                Order Number *
              </label>
              <input
                type="text"
                placeholder="e.g. #ORD1086"
                value={orderNumberInput}
                onChange={(e) => setOrderNumberInput(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(224, 176, 74, 0.3)',
                  borderRadius: '8px',
                  color: 'var(--ink)',
                  fontSize: '14px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                Email Address (Optional if token saved)
              </label>
              <input
                type="email"
                placeholder="devotee@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(224, 176, 74, 0.3)',
                  borderRadius: '8px',
                  color: 'var(--ink)',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            disabled={loading}
            style={{ width: '100%', padding: '12px', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Searching Temple Database...' : 'Track Order →'}
          </button>
        </form>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Order Details View */}
        {orderData && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(224, 176, 74, 0.2)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--muted)' }}>Order ID</span>
                <h4 style={{ fontSize: '18px', color: 'var(--gold-lt)', margin: 0 }}>{orderData.order_number}</h4>
              </div>
              <div style={{
                padding: '6px 14px',
                borderRadius: '20px',
                background: currentStatus.bg,
                border: `1px solid ${currentStatus.border}`,
                color: currentStatus.text,
                fontSize: '12px',
                fontWeight: 600,
              }}>
                {currentStatus.label}
              </div>
            </div>

            {/* Devotee & Delivery Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px', marginBottom: '16px' }}>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Devotee Name</span>
                <strong>{orderData.customer_name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Placed On</span>
                <span>{orderData.placed_at ? new Date(orderData.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Delivery Address</span>
                <span style={{ color: 'var(--ink)' }}>{orderData.shipping_address || 'Provided at checkout'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Payment Mode</span>
                <span style={{ color: 'var(--gold-lt)' }}>{orderData.payment_method} ({orderData.payment_status?.toUpperCase()})</span>
              </div>
            </div>

            {/* Items */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '10px' }}>
                Consecrated Items
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {orderData.items?.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
                    <span>
                      {it.product_name} <span style={{ color: 'var(--muted)' }}>× {it.quantity}</span>
                    </span>
                    <strong style={{ color: 'var(--gold-lt)' }}>₹{(it.total_price || 0).toLocaleString('en-IN')}</strong>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '15px', fontWeight: 700, color: 'var(--gold-lt)' }}>
                <span>Total Amount Paid</span>
                <span>₹{(orderData.total_amount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Actions: Cancel / Return */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {orderData.order_status === 'pending' && (
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={actionLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {actionLoading ? 'Processing...' : 'Cancel Order'}
                </button>
              )}

              {(orderData.order_status === 'delivered' || orderData.order_status === 'completed') && !showReturnForm && (
                <button
                  type="button"
                  onClick={() => setShowReturnForm(true)}
                  disabled={actionLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'rgba(224, 176, 74, 0.1)',
                    border: '1px solid rgba(224, 176, 74, 0.3)',
                    color: 'var(--gold-lt)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Request Return / Exchange
                </button>
              )}
            </div>

            {/* Return Form Accordion */}
            {showReturnForm && (
              <form onSubmit={handleReturnSubmit} style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
                  Reason for Return / Exchange *
                </label>
                <textarea
                  rows={3}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Size exchange requested, or received item query..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(224, 176, 74, 0.3)',
                    borderRadius: '6px',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    marginBottom: '10px',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    className="btn btn-gold"
                    disabled={actionLoading}
                    style={{ padding: '8px 16px', fontSize: '12px' }}
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Return Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReturnForm(false)}
                    style={{
                      padding: '8px 14px',
                      background: 'none',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      color: 'var(--muted)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
