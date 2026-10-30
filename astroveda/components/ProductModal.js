'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/context/StoreContext';
import { findProduct } from '@/lib/products';
import { getProductDetail, submitProductReview } from '@/lib/api';
import ReCaptcha from '@/components/ReCaptcha';

export default function ProductModal() {
  const { productModal, closeProductModal, addToCart, showToast } = useStore();
  const { show, title, product: passedProduct } = productModal;

  const [liveDetails, setLiveDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Review submission state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: '', email: '', rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewCaptchaToken, setReviewCaptchaToken] = useState('');
  const reviewRecaptchaRef = useRef(null);

  const product = passedProduct || findProduct(title);

  const modalImages = (liveDetails?.images && liveDetails.images.length > 0)
    ? liveDetails.images
    : ((product?.images && product.images.length > 0)
      ? product.images
      : (product?.img ? [product.img] : []));

  const [modalImgIdx, setModalImgIdx] = useState(0);

  useEffect(() => {
    if (show && product) {
      const initIdx = typeof product.activeImageIdx === 'number'
        ? product.activeImageIdx
        : (typeof productModal?.activeImageIdx === 'number' ? productModal.activeImageIdx : 0);
      setModalImgIdx(initIdx);
    }
  }, [show, product, productModal?.activeImageIdx]);

  const totalModalImgs = modalImages.length;
  const safeModalIdx = totalModalImgs > 0 ? (modalImgIdx % totalModalImgs) : 0;
  const currentModalImg = modalImages[safeModalIdx];

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

  // Dynamic attribute lookups (checking liveDetails first, then product, then attributes)
  const getAttr = (key, altKey) => {
    return (
      liveDetails?.attributes?.[key] ||
      (altKey ? liveDetails?.attributes?.[altKey] : null) ||
      liveDetails?.[key] ||
      (altKey ? liveDetails?.[altKey] : null) ||
      product?.[key] ||
      product?.attributes?.[key] ||
      (altKey ? (product?.[altKey] || product?.attributes?.[altKey]) : null) ||
      ''
    );
  };

  const material = getAttr('material');
  const size = getAttr('size');
  const energized = getAttr('energized');
  const installation = getAttr('installation');
  const mukhi = getAttr('mukhi');
  const origin = getAttr('origin');
  const carat = getAttr('carat');
  const metal = getAttr('metal');
  const beadSize = getAttr('bead_size', 'beadSize');
  const certLabel = getAttr('cert_label') || (
    product?.certification_status === 'certified' || liveDetails?.certification_status === 'certified'
      ? 'Lab Certified'
      : (product?.certification_status === 'premium' || liveDetails?.certification_status === 'premium' ? 'Temple Grade' : 'Verified')
  );

  const rows = [];
  if (material) rows.push({ k: 'Material', v: material });
  if (size) rows.push({ k: 'Size', v: size });
  if (beadSize) rows.push({ k: 'Bead Size', v: beadSize });
  if (mukhi) rows.push({ k: 'Mukhi', v: mukhi });
  if (carat) rows.push({ k: 'Carat', v: carat });
  if (metal) rows.push({ k: 'Metal / Setting', v: metal });
  if (energized) rows.push({ k: 'Energised', v: energized });
  if (installation) rows.push({ k: 'Installation', v: installation });
  if (origin) rows.push({ k: 'Origin', v: origin });
  if (certLabel) rows.push({ k: 'Certification', v: certLabel });

  if (rows.length === 0) {
    const t = (product.title || '').toLowerCase();
    if (t.includes('rudraksha') || t.includes('mukhi')) {
      const m = product.title.match(/(\d+)\s*Mukhi/i);
      rows.push({ k: 'Mukhi', v: m ? m[1] : '5' });
      rows.push({ k: 'Origin', v: 'Nepal' });
      rows.push({ k: 'Certification', v: 'Lab Certified' });
    } else if (t.includes('yantra')) {
      rows.push({ k: 'Material', v: '99.4% Pure Copper' });
      rows.push({ k: 'Size', v: '3 × 3 inch' });
      rows.push({ k: 'Energised', v: 'Pran-Pratishtha done' });
      rows.push({ k: 'Installation', v: 'Guidance included' });
    } else if (t.includes('bracelet')) {
      rows.push({ k: 'Bead Size', v: '8 mm' });
      rows.push({ k: 'Fit', v: 'Elastic Stretchable' });
      rows.push({ k: 'Certification', v: 'Lab Certified' });
    } else {
      rows.push({ k: 'Certification', v: 'Lab Certified' });
    }
  }

  const significance = getAttr('significance_mr') || getAttr('significance_en') || getAttr('significance');
  const howToWear = getAttr('how_to_wear_mr') || getAttr('how_to_wear');
  const mantra = getAttr('mantra');
  const care = getAttr('care_mr') || getAttr('care');
  const shipping = getAttr('shipping_mr') || getAttr('shipping');

  const curPrice = liveDetails?.price !== undefined ? liveDetails.price : (product.priceNum ?? priceNum);
  const curCompare = liveDetails?.compare_price !== undefined ? liveDetails.compare_price : (product.comparePriceNum ?? null);
  const displayPrice = `₹${Number(curPrice).toLocaleString('en-IN')}`;
  const displayCompare = curCompare && Number(curCompare) > Number(curPrice)
    ? `₹${Number(curCompare).toLocaleString('en-IN')}`
    : (product.priceOld || null);
  const displaySave = curCompare && Number(curCompare) > Number(curPrice)
    ? `${Math.round(((Number(curCompare) - Number(curPrice)) / Number(curCompare)) * 100)}% off`
    : (product.save || null);

  const curStock = liveDetails?.stock_quantity !== undefined ? liveDetails.stock_quantity : (product.stock_quantity ?? 0);
  const lowThreshold = liveDetails?.low_stock_threshold !== undefined ? liveDetails.low_stock_threshold : (product.low_stock_threshold ?? 10);
  const isInStock = liveDetails?.is_in_stock !== undefined ? liveDetails.is_in_stock : (curStock > 0);

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

    if (!reviewCaptchaToken) {
      showToast('Please complete the CAPTCHA verification (कृपया कॅप्चा पूर्ण करा).');
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await submitProductReview(product.slug, {
        customer_name: reviewForm.name.trim(),
        customer_email: reviewForm.email.trim(),
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
        recaptcha_token: reviewCaptchaToken,
      });
      showToast(res.message || 'Review submitted successfully!');
      setShowReviewForm(false);
      setReviewForm({ name: '', email: '', rating: 5, comment: '' });
      // Refresh live details
      if (product.slug) {
        getProductDetail(product.slug).then(r => setLiveDetails(r)).catch(() => {});
      }
    } catch (err) {
      reviewRecaptchaRef.current?.reset();
      setReviewCaptchaToken('');
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

          <div className="pd-img-main-wrap">
            {currentModalImg && currentModalImg.startsWith('<') ? (
              <div dangerouslySetInnerHTML={{ __html: currentModalImg }} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
            ) : (
              <img
                src={currentModalImg || ''}
                alt={`${product.title} - view ${safeModalIdx + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }}
              />
            )}

            {totalModalImgs > 1 && (
              <>
                <button
                  type="button"
                  className="pd-img-arrow left"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalImgIdx((prev) => (prev > 0 ? prev - 1 : totalModalImgs - 1));
                  }}
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="pd-img-arrow right"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalImgIdx((prev) => (prev < totalModalImgs - 1 ? prev + 1 : 0));
                  }}
                  aria-label="Next image"
                >
                  ›
                </button>
              </>
            )}
          </div>

          {totalModalImgs > 1 && (
            <div className="pd-thumbnails">
              {modalImages.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className={`pd-thumb-btn${i === safeModalIdx ? ' active' : ''}`}
                  onClick={() => setModalImgIdx(i)}
                  aria-label={`View image ${i + 1}`}
                >
                  {src && src.startsWith('<') ? (
                    <div dangerouslySetInnerHTML={{ __html: src }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <img src={src} alt="" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <h3>{liveDetails?.name || product.title}</h3>
          <div className="pd-price-row">
            <span className="p1">{displayPrice}</span>
            {displayCompare && <span className="p2">{displayCompare}</span>}
            {displaySave && <span className="p3">{displaySave}</span>}
          </div>

          <div className="pd-stars">
            ★★★★★{' '}
            <span style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--sans)', letterSpacing: 0 }}>
              {ratingScore} · {reviewCount} reviews
              {isInStock ? (
                curStock <= lowThreshold ? (
                  <span style={{ marginLeft: '12px', color: '#f59e0b', fontWeight: 600 }}>
                    ⚠️ Low Stock (Only {curStock} left)
                  </span>
                ) : (
                  <span style={{ marginLeft: '12px', color: '#4ade80', fontWeight: 500 }}>
                    ✓ In Stock ({curStock} available)
                  </span>
                )
              ) : (
                <span style={{ marginLeft: '12px', color: '#f87171', fontWeight: 600 }}>
                  ✕ Out of Stock
                </span>
              )}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0 12px' }}>
            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              ✓ Cash on Delivery (COD) Available
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(224, 176, 74, 0.1)', color: 'var(--gold-lt)', border: '1px solid rgba(224, 176, 74, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              ✓ Online UPI / Cards / Net Banking
            </span>
          </div>

          <p className="pd-lead">{liveDetails?.description || product.desc}</p>

          {rows.length > 0 && (
            <div className="pd-details">
              {rows.map((r, i) => (
                <div key={i} className="row">
                  <span className="k">{r.k}</span>
                  <span className="v">{r.v}</span>
                </div>
              ))}
            </div>
          )}

          {significance ? (
            <div className="pd-section">
              <h5>Traditional Significance</h5>
              <p>{significance}</p>
            </div>
          ) : product.desc ? (
            <div className="pd-section">
              <h5>Traditional Significance</h5>
              <p>{product.desc} पारंपरिक शास्त्रानुसार धारण करण्याची पद्धत आणि महत्त्व सविस्तर मार्गदर्शनासह दिले जाते.</p>
            </div>
          ) : null}

          {howToWear ? (
            <div className="pd-section">
              <h5>How to Wear · धारण पद्धत</h5>
              <p>{howToWear}</p>
            </div>
          ) : null}

          {mantra ? (
            <div className="pd-section">
              <h5>Mantra · मंत्र</h5>
              <p className="mantra">{mantra}</p>
            </div>
          ) : null}

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
                <ReCaptcha
                  id={`recaptcha-review-${product.id}`}
                  ref={reviewRecaptchaRef}
                  onChange={setReviewCaptchaToken}
                  onExpired={() => setReviewCaptchaToken('')}
                  onError={() => setReviewCaptchaToken('')}
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

          {care ? (
            <div className="pd-section">
              <h5>Care Instructions</h5>
              <p>{care}</p>
            </div>
          ) : null}

          <div className="pd-section">
            <h5>Shipping, Payment &amp; Return Policy</h5>
            <p style={{ margin: '0 0 6px', fontSize: '12.5px', color: 'var(--cream)' }}>
              <strong>Payment Options:</strong> Online Payment (Razorpay, UPI, Credit/Debit Cards, Net Banking) and Cash on Delivery (COD) available across India.
            </p>
            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)', lineHeight: '1.5' }}>
              <strong>Return Policy:</strong> Products listed on this website are offered under the applicable payment options, including Cash on Delivery wherever available. Products are generally non-returnable and non-exchangeable once purchased. However, customers should contact customer support regarding products that are delivered damaged, defective, incorrect, counterfeit, or materially different from their advertised description. Any refunds, replacements, or other remedies will be handled in accordance with applicable consumer protection laws and the published product policy.
            </p>
          </div>

          <div className="pd-actions">
            <button
              className="btn btn-gold"
              onClick={handleAddToCart}
              disabled={!isInStock}
              style={!isInStock ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {isInStock ? 'Add to Cart' : 'Out of Stock'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleAddToCart}
              disabled={!isInStock}
              style={!isInStock ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
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

