'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { findProduct } from '@/lib/products';
import { getProductDetail, submitProductReview } from '@/lib/api';

export default function ProductModal() {
  const { productModal, closeProductModal, addToCart, showToast } = useStore();
  const { show, title, product: passedProduct } = productModal;

  const [liveDetails, setLiveDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Review submission state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: '', email: '', rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  const product = passedProduct || findProduct(title);

  useEffect(() => {
    if (show && product && product.slug) {
      setLoadingDetails(true);
      setShowReviewForm(false);
      setReviewForm({ name: '', email: '', rating: 5, comment: '' });
      getProductDetail(product.slug)
        .then(res => {
          setLiveDetails(res);
        })
        .catch(err => {
          console.warn('Could not load live product details:', err);
          setLiveDetails(null);
        })
        .finally(() => {
          setLoadingDetails(false);
        });
    } else {
      setLiveDetails(null);
    }
  }, [show, product]);

  if (!show || (!title && !passedProduct)) return null;
  if (!product) return null;

  const priceNum = parseInt(String(product.price).replace(/[^\d]/g, ''), 10) || 0;

  const rowsFor = (tTitle) => {
    const t = tTitle.toLowerCase();
    if (t.includes('rudraksha') || t.includes('mukhi')) {
      const m = tTitle.match(/(\d+)\s*Mukhi/);
      return [
        { k: 'Mukhi', v: m ? m[1] : '5' },
        { k: 'Size', v: '18 mm' },
        { k: 'Origin', v: 'Nepal' },
        { k: 'Certification', v: 'Available' },
      ];
    }
    if (t.includes('yantra')) {
      return [
        { k: 'Material', v: '99.4% Pure Copper' },
        { k: 'Size', v: '3 × 3 inch' },
        { k: 'Energised', v: 'Pran-Pratishtha done' },
        { k: 'Installation', v: 'Guidance included' },
      ];
    }
    if (t.includes('bracelet')) {
      return [
        { k: 'Bead Size', v: '8 mm' },
        { k: 'Fit', v: 'Elastic' },
        { k: 'Beads', v: '12 / 108' },
        { k: 'Wearing', v: 'Left hand' },
      ];
    }
    if (t.includes('mala')) {
      return [
        { k: 'Beads', v: '108' },
        { k: 'Size', v: '8 mm' },
        { k: 'Type', v: 'Traditional' },
        { k: 'Energised', v: 'Yes' },
      ];
    }
    return [
      { k: 'Carat', v: '4.2 ct' },
      { k: 'Certification', v: 'IGI / GIA' },
      { k: 'Setting', v: 'Panchdhatu' },
      { k: 'Origin', v: 'Ceylon / Colombian' },
    ];
  };

  const rows = rowsFor(product.title);

  const badgeTxt = { hot: 'Bestseller', new: 'New Drop', lab: 'Lab Certified' };

  let badgeStyle = {};
  if (product.badge === 'hot') {
    badgeStyle = {
      background: 'linear-gradient(100deg,var(--saffron),var(--pink))',
      color: '#1a0a0f',
      borderColor: 'transparent',
    };
  } else if (product.badge === 'new') {
    badgeStyle = {
      background: 'rgba(96,165,250,.16)',
      color: '#a8cdfb',
      borderColor: 'rgba(96,165,250,.35)',
    };
  }

  const handleAddToCart = () => {
    addToCart(product, priceNum);
    closeProductModal();
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.name.trim() || !reviewForm.email.trim() || !reviewForm.comment.trim()) {
      showToast('Please provide your name, email, and review comment.');
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await submitProductReview(product.slug, {
        customer_name: reviewForm.name.trim(),
        customer_email: reviewForm.email.trim(),
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
      });
      showToast(res.message || 'Review submitted successfully!');
      setShowReviewForm(false);
      setReviewForm({ name: '', email: '', rating: 5, comment: '' });
      // Refresh live details
      if (product.slug) {
        getProductDetail(product.slug).then(r => setLiveDetails(r)).catch(() => {});
      }
    } catch (err) {
      showToast(err.message || 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const reviewsList = liveDetails?.reviews || [];
  const reviewCount = liveDetails?.review_count ?? product.reviews ?? 0;
  const ratingScore = liveDetails?.average_rating ?? product.rating ?? '5.0';

  return (
    <div
      className="pd-modal-overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeProductModal();
      }}
    >
      <div className="pd-modal">
        <button
          className="pd-close"
          onClick={closeProductModal}
          aria-label="Close details"
        >
          ✕
        </button>

        <div className="pd-visual">
          <span className="badge-float" style={badgeStyle}>
            ✓ {product.badge ? badgeTxt[product.badge] : 'Authentic'}
          </span>
          <div dangerouslySetInnerHTML={{ __html: product.img || '' }} />
        </div>

        <div className="pd-info">
          <h3>{product.title}</h3>
          <div className="pd-price-row">
            <span className="p1">{product.price}</span>
            {product.priceOld && <span className="p2">{product.priceOld}</span>}
            {product.save && <span className="p3">{product.save}</span>}
          </div>

          <div className="pd-stars">
            ★★★★★{' '}
            <span style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--sans)', letterSpacing: 0 }}>
              {ratingScore} · {reviewCount} reviews
              {liveDetails?.is_in_stock !== undefined && (
                <span style={{ marginLeft: '12px', color: liveDetails.is_in_stock ? '#4ade80' : '#f87171' }}>
                  {liveDetails.is_in_stock ? `✓ In Stock (${liveDetails.stock_quantity ?? 'Available'})` : 'Out of Stock'}
                </span>
              )}
            </span>
          </div>

          <p className="pd-lead">{liveDetails?.description || product.desc}</p>

          <div className="pd-details">
            {rows.map((r, i) => (
              <div key={i} className="row">
                <span className="k">{r.k}</span>
                <span className="v">{r.v}</span>
              </div>
            ))}
          </div>

          <div className="pd-section">
            <h5>Traditional Significance</h5>
            <p>{product.desc} पारंपरिक शास्त्रानुसार धारण करण्याची पद्धत आणि महत्त्व सविस्तर मार्गदर्शनासह दिले जाते.</p>
          </div>

          <div className="pd-section">
            <h5>How to Wear · धारण पद्धत</h5>
            <p>सकाळी स्नान करून, तांब्याच्या पात्रातील गंगाजलाने शुद्ध करून, योग्य मंत्राने 108 वेळा अभिमंत्रित करून धारण करावे. तज्ञ मार्गदर्शनासाठी WhatsApp वर संपर्क करा.</p>
          </div>

          <div className="pd-section">
            <h5>Mantra · मंत्र</h5>
            <p className="mantra">ॐ ह्रीं नमः</p>
          </div>

          {/* Customer Reviews Section */}
          <div className="pd-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h5 style={{ margin: 0 }}>Devotee Reviews ({reviewCount})</h5>
              <button
                type="button"
                onClick={() => setShowReviewForm(prev => !prev)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(224, 176, 74, 0.4)',
                  borderRadius: '4px',
                  color: 'var(--gold-lt)',
                  fontSize: '11px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                {showReviewForm ? 'Close Form' : '✍️ Write Review'}
              </button>
            </div>

            {showReviewForm && (
              <form onSubmit={handleReviewSubmit} style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(224, 176, 74, 0.25)', marginBottom: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Your Name *"
                    value={reviewForm.name}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                    style={{ padding: '8px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(224, 176, 74, 0.2)', color: 'var(--ink)', fontSize: '12px' }}
                  />
                  <input
                    type="email"
                    placeholder="Your Email *"
                    value={reviewForm.email}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    style={{ padding: '8px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(224, 176, 74, 0.2)', color: 'var(--ink)', fontSize: '12px' }}
                  />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '3px' }}>Rating:</label>
                  <select
                    value={reviewForm.rating}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, rating: Number(e.target.value) }))}
                    style={{ padding: '6px 10px', borderRadius: '4px', background: 'rgba(20, 10, 15, 0.95)', border: '1px solid rgba(224, 176, 74, 0.2)', color: 'var(--gold-lt)', fontSize: '12px' }}
                  >
                    <option value={5}>★★★★★ (5/5) - Excellent</option>
                    <option value={4}>★★★★☆ (4/5) - Very Good</option>
                    <option value={3}>★★★☆☆ (3/5) - Good</option>
                    <option value={2}>★★☆☆☆ (2/5) - Fair</option>
                    <option value={1}>★☆☆☆☆ (1/5) - Poor</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  placeholder="Share your spiritual experience with this product..."
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(224, 176, 74, 0.2)', color: 'var(--ink)', fontSize: '12px', marginBottom: '8px' }}
                />
                <button
                  type="submit"
                  className="btn btn-gold"
                  disabled={submittingReview}
                  style={{ padding: '6px 14px', fontSize: '11px' }}
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )}

            {reviewsList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                {reviewsList.map((rev, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gold-lt)', marginBottom: '3px' }}>
                      <strong>{rev.customer_name || 'Devotee'}</strong>
                      <span>{'★'.repeat(rev.rating || 5)}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--ink)', fontSize: '11px' }}>{rev.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                Certified product from sacred origins. Be the first to leave a review!
              </p>
            )}
          </div>

          <div className="pd-section">
            <h5>Care Instructions</h5>
            <p>पाण्यात भिजवू नका, रासायनिक साबण वापरू नका. महिन्यातून एकदा गंगाजलाने शुद्ध करा.</p>
          </div>

          <div className="pd-section">
            <h5>Shipping &amp; Returns</h5>
            <p>48 तासांत डिस्पॅच · 7 दिवसांत easy returns · संपूर्ण भारतात मोफत शिपिंग (₹999 वर).</p>
          </div>

          <div className="pd-actions">
            <button className="btn btn-gold" onClick={handleAddToCart}>
              Add to Cart
            </button>
            <button className="btn btn-ghost" onClick={handleAddToCart}>
              Buy Now
            </button>
          </div>

          <a
            href="https://wa.me/919000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="pd-wa"
          >
            Need Guidance? WhatsApp Guruji
          </a>
        </div>
      </div>
    </div>
  );
}

