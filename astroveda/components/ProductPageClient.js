'use client';

import { useState, useRef } from 'react';
import { useStore } from '@/context/StoreContext';
import { submitProductReview } from '@/lib/api';
import ReCaptcha from '@/components/ReCaptcha';

export default function ProductPageClient({ product, liveDetails = null }) {
  const { addToCart, setCartOpen, openCheckout, toggleWishlist, isInWishlist, showToast } = useStore();

  const details = liveDetails || product;
  const inWish = isInWishlist(product.title);

  // Gallery images
  const allImages = (details?.images && details.images.length > 0)
    ? details.images
    : ((product?.images && product.images.length > 0)
      ? product.images
      : (product?.img ? [product.img] : []));

  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState('significance');

  // Review submission state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: '', email: '', rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewCaptchaToken, setReviewCaptchaToken] = useState('');
  const [reviewsList, setReviewsList] = useState(details?.reviews || product?.reviews || []);
  const reviewRecaptchaRef = useRef(null);

  const priceNum = Number(details?.price !== undefined ? details.price : product.priceNum) || 0;
  const compareNum = Number(details?.compare_price !== undefined ? details.compare_price : product.comparePriceNum) || null;
  const hasDiscount = compareNum && compareNum > priceNum;
  const savePct = hasDiscount ? Math.round(((compareNum - priceNum) / compareNum) * 100) : null;

  const isInStock = details?.is_in_stock !== undefined
    ? details.is_in_stock
    : (details?.stock_quantity !== undefined ? details.stock_quantity > 0 : product.is_in_stock);

  const stockQty = details?.stock_quantity ?? product.stock_quantity ?? 10;

  const currentImg = allImages[activeImgIdx % (allImages.length || 1)] || product.img;

  // Attribute helper
  const getAttr = (key, altKey) => {
    return (
      details?.attributes?.[key] ||
      (altKey ? details?.attributes?.[altKey] : null) ||
      details?.[key] ||
      (altKey ? details?.[altKey] : null) ||
      product?.[key] ||
      product?.attributes?.[key] ||
      (altKey ? (product?.[altKey] || product?.attributes?.[altKey]) : null) ||
      ''
    );
  };

  const material = getAttr('material');
  const size = getAttr('size');
  const beadSize = getAttr('bead_size', 'beadSize');
  const mukhi = getAttr('mukhi');
  const origin = getAttr('origin');
  const carat = getAttr('carat');
  const metal = getAttr('metal');
  const energized = getAttr('energized');
  const installation = getAttr('installation');
  const certLabel = getAttr('cert_label') || (
    product?.certification_status === 'certified' || details?.certification_status === 'certified'
      ? 'Lab Certified'
      : (product?.certification_status === 'premium' || details?.certification_status === 'premium' ? 'Temple Grade' : 'Authentic Sourcing')
  );

  const significance = getAttr('significance_mr') || getAttr('significance_en') || getAttr('significance') || product.desc;
  const howToWear = getAttr('how_to_wear_mr') || getAttr('how_to_wear');
  const mantra = getAttr('mantra');
  const care = getAttr('care_mr') || getAttr('care');

  const specs = [];
  if (mukhi) specs.push({ label: 'Mukhi (Faces)', val: `${mukhi} Mukhi` });
  if (origin) specs.push({ label: 'Origin', val: origin });
  if (material) specs.push({ label: 'Material', val: material });
  if (beadSize) specs.push({ label: 'Bead Size', val: beadSize });
  if (size) specs.push({ label: 'Dimensions / Size', val: size });
  if (carat) specs.push({ label: 'Weight / Carat', val: carat });
  if (metal) specs.push({ label: 'Metal / Setting', val: metal });
  if (energized) specs.push({ label: 'Consecration (Pran-Pratishtha)', val: energized });
  if (installation) specs.push({ label: 'Installation / Vidhi', val: installation });
  if (certLabel) specs.push({ label: 'Certification', val: certLabel });
  if (product.sku) specs.push({ label: 'SKU', val: product.sku });

  const handleAddToCart = () => {
    if (!isInStock) return;
    addToCart(product, priceNum, qty);
    setCartOpen(true);
    if (showToast) {
      showToast(`Added ${qty} × ${product.title} to cart`);
    }
  };

  const handleBuyNow = () => {
    if (!isInStock) return;
    addToCart(product, priceNum, qty);
    if (openCheckout) {
      openCheckout();
    } else {
      setCartOpen(true);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.name || !reviewForm.comment) return;
    setSubmittingReview(true);
    try {
      await submitProductReview(product.slug, {
        customer_name: reviewForm.name,
        email: reviewForm.email,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
        captcha_token: reviewCaptchaToken,
      });
      showToast?.('Thank you for submitting your review. It will appear once approved by our seva team.');
      setShowReviewForm(false);
      setReviewForm({ name: '', email: '', rating: 5, comment: '' });
      if (reviewRecaptchaRef.current?.reset) {
        reviewRecaptchaRef.current.reset();
      }
    } catch (err) {
      showToast?.(err.message || 'Could not submit review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const waMessage = `Pranam Guruji, I am inquiring about *${product.title}* (SKU: ${product.sku || 'N/A'}, Price: ₹${priceNum.toLocaleString('en-IN')}). Please provide guidance on consecration rituals and dispatch.`;
  const waUrl = `https://wa.me/919623117545?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="product-page-wrapper">
      <div className="product-page-grid">
        {/* Gallery Column */}
        <div className="product-gallery-col">
          <div className="product-main-visual">
            {certLabel && (
              <span className="product-visual-badge">
                🔬 {certLabel}
              </span>
            )}
            <button
              type="button"
              className={`product-wish-btn${inWish ? ' active' : ''}`}
              aria-label={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
              onClick={() => toggleWishlist(product, priceNum)}
            >
              <svg viewBox="0 0 24 24" fill={inWish ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>
              </svg>
            </button>

            <div className="product-image-container">
              {currentImg && currentImg.startsWith('<') ? (
                <div
                  dangerouslySetInnerHTML={{ __html: currentImg }}
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
              ) : (
                <img
                  src={currentImg || '/categories/rudraksha.png'}
                  alt={product.title}
                  className="product-main-img"
                  loading="eager"
                />
              )}
            </div>
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="product-thumbs-strip">
              {allImages.map((imgSrc, idx) => {
                const isActive = idx === (activeImgIdx % allImages.length);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`product-thumb-btn${isActive ? ' active' : ''}`}
                    onClick={() => setActiveImgIdx(idx)}
                    aria-label={`View image ${idx + 1}`}
                  >
                    {imgSrc && imgSrc.startsWith('<') ? (
                      <div dangerouslySetInnerHTML={{ __html: imgSrc }} style={{ width: '32px', height: '32px' }} />
                    ) : (
                      <img src={imgSrc} alt="" className="product-thumb-img" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Verified Product Guarantees */}
          <div className="product-trust-strip">
            {energized ? (
              <div className="trust-pill">
                <span className="pill-icon">🪔</span>
                <div>
                  <strong>Consecration &amp; Vidhi</strong>
                  <p>{energized}</p>
                </div>
              </div>
            ) : null}
            {certLabel ? (
              <div className="trust-pill">
                <span className="pill-icon">🔬</span>
                <div>
                  <strong>{certLabel}</strong>
                  <p>Quality and authenticity verification</p>
                </div>
              </div>
            ) : null}
            <div className="trust-pill">
              <span className="pill-icon">📦</span>
              <div>
                <strong>Insured Safe Delivery</strong>
                <p>Secure protective packaging across India</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info & Purchase Column */}
        <div className="product-info-col">
          <div className="product-category-tag">{product.catLabel || 'Sacred Collection'}</div>
          <h1 className="product-title-h1">{product.title}</h1>

          {/* Ratings & Devotee Trust (only displayed if actual approved reviews exist) */}
          {reviewsList.length > 0 && (
            <div className="product-rating-row">
              <div className="stars">{'★'.repeat(Math.round(details?.average_rating || 5))}</div>
              <span className="rating-score">{details?.average_rating || '5.0'}</span>
              <span className="rating-count">({reviewsList.length} devotee {reviewsList.length === 1 ? 'review' : 'reviews'})</span>
            </div>
          )}

          {/* Price Box */}
          <div className="product-pricing-card">
            <div className="price-row">
              <span className="price-current">₹{priceNum.toLocaleString('en-IN')}</span>
              {hasDiscount && (
                <>
                  <span className="price-was">₹{compareNum.toLocaleString('en-IN')}</span>
                  <span className="price-discount-badge">{savePct}% OFF</span>
                </>
              )}
            </div>
            <p className="price-tax-note">Inclusive of all applicable taxes</p>

            {/* Stock status indicator */}
            <div className="stock-status-row">
              {isInStock ? (
                <span className="stock-badge in-stock">
                  <span className="status-dot"></span> In Stock · Ready for Dispatch
                </span>
              ) : (
                <span className="stock-badge out-stock">
                  <span className="status-dot"></span> Currently Out of Stock
                </span>
              )}
            </div>
          </div>

          {/* Product Description */}
          <div className="product-short-desc">
            <p>{product.desc}</p>
          </div>

          {/* Specifications Table */}
          {specs.length > 0 && (
            <div className="product-specs-box">
              <h3 className="specs-heading">Vedic Specifications &amp; Authenticity</h3>
              <div className="specs-table">
                {specs.map((item, i) => (
                  <div key={i} className="specs-row">
                    <span className="specs-key">{item.label}</span>
                    <span className="specs-val">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quantity & Actions */}
          <div className="product-action-section">
            <div className="quantity-selector-box">
              <label htmlFor="prod-qty">Quantity:</label>
              <div className="qty-controls">
                <button
                  type="button"
                  onClick={() => setQty(prev => Math.max(1, prev - 1))}
                  disabled={qty <= 1 || !isInStock}
                  className="qty-btn"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="qty-value">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(prev => Math.min(stockQty, prev + 1))}
                  disabled={qty >= stockQty || !isInStock}
                  className="qty-btn"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            <div className="action-buttons-group">
              <button
                type="button"
                className="btn btn-gold btn-purchase"
                onClick={handleAddToCart}
                disabled={!isInStock}
              >
                🛒 Add to Cart • ₹{(priceNum * qty).toLocaleString('en-IN')}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-buy-now"
                onClick={handleBuyNow}
                disabled={!isInStock}
              >
                Instant Checkout →
              </button>
            </div>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp-consult"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.2-.7.2-.8 1-1 1.2-.4.3-.7.1a8 8 0 01-2.4-1.5 9 9 0 01-1.6-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-1-2.4c-.2-.6-.5-.5-.7-.5H7a1.4 1.4 0 00-1 .5 4.3 4.3 0 00-1.3 3.2 7.4 7.4 0 001.6 4 17 17 0 006.6 5.8c.9.4 1.6.6 2.2.8a5.3 5.3 0 002.4.1 4 4 0 002.6-1.8 3.2 3.2 0 00.2-1.8c-.1-.2-.3-.3-.6-.4zM12 22a10 10 0 01-5.1-1.4L2 22l1.4-4.8A10 10 0 1112 22z" />
              </svg>
              <span>Ask Guruji via WhatsApp Guidance</span>
            </a>
          </div>

          {/* Dispatch Note */}
          <div className="product-policy-notice">
            <p>
              <strong>Order &amp; Delivery Information:</strong> Securely packaged and delivered across India via insured courier.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs / Deep Knowledge Section */}
      <div className="product-tabs-container">
        <div className="tabs-header">
          <button
            type="button"
            className={`tab-btn${activeTab === 'significance' ? ' active' : ''}`}
            onClick={() => setActiveTab('significance')}
          >
            Vedic Significance
          </button>
          {howToWear && (
            <button
              type="button"
              className={`tab-btn${activeTab === 'vidhi' ? ' active' : ''}`}
              onClick={() => setActiveTab('vidhi')}
            >
              Wearing Vidhi &amp; Rules
            </button>
          )}
          {care && (
            <button
              type="button"
              className={`tab-btn${activeTab === 'care' ? ' active' : ''}`}
              onClick={() => setActiveTab('care')}
            >
              Care &amp; Sanctity
            </button>
          )}
          <button
            type="button"
            className={`tab-btn${activeTab === 'reviews' ? ' active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            Devotee Reviews ({reviewsList.length})
          </button>
        </div>

        <div className="tabs-content-body">
          {activeTab === 'significance' && (
            <div className="tab-pane">
              <h3>Spiritual Importance &amp; Energy Alignment</h3>
              <p>{significance}</p>
              {mantra && (
                <div className="sacred-mantra-box">
                  <span className="mantra-label">॥ सिद्ध धारण मंत्र ॥</span>
                  <p className="mantra-text">{mantra}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'vidhi' && (
            <div className="tab-pane">
              <h3>Traditional Wearing Vidhi &amp; Rules</h3>
              <p>{howToWear}</p>
            </div>
          )}

          {activeTab === 'care' && (
            <div className="tab-pane">
              <h3>Preserving Sanctity &amp; Care Instructions</h3>
              <p>{care}</p>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="tab-pane">
              <div className="reviews-header-bar">
                <h3>Devotee Reviews &amp; Experiences</h3>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowReviewForm(prev => !prev)}
                >
                  {showReviewForm ? 'Cancel' : '✍ Write a Review'}
                </button>
              </div>

              {showReviewForm && (
                <form onSubmit={handleReviewSubmit} className="product-review-form">
                  <div className="form-row-2">
                    <input
                      type="text"
                      placeholder="Your Full Name (devotee)"
                      value={reviewForm.name}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                    <input
                      type="email"
                      placeholder="Your Email (private)"
                      value={reviewForm.email}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="form-rating-row">
                    <label>Your Rating:</label>
                    <select
                      value={reviewForm.rating}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, rating: Number(e.target.value) }))}
                    >
                      <option value="5">★★★★★ (5 Stars — Excellent)</option>
                      <option value="4">★★★★☆ (4 Stars — Very Good)</option>
                      <option value="3">★★★☆☆ (3 Stars — Good)</option>
                      <option value="2">★★☆☆☆ (2 Stars — Fair)</option>
                      <option value="1">★☆☆☆☆ (1 Star — Poor)</option>
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Share your spiritual experience with this product..."
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                    required
                  />
                  <ReCaptcha
                    id={`recaptcha-prod-page-${product.id}`}
                    ref={reviewRecaptchaRef}
                    onChange={setReviewCaptchaToken}
                    onExpired={() => setReviewCaptchaToken('')}
                    onError={() => setReviewCaptchaToken('')}
                  />
                  <button
                    type="submit"
                    className="btn btn-gold"
                    disabled={submittingReview}
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Devotee Review'}
                  </button>
                </form>
              )}

              {reviewsList.length > 0 ? (
                <div className="reviews-list-grid">
                  {reviewsList.map((rev, idx) => (
                    <div key={idx} className="review-card">
                      <div className="review-card-head">
                        <strong>{rev.customer_name || 'Devotee'}</strong>
                        <span className="review-stars">{'★'.repeat(rev.rating || 5)}</span>
                      </div>
                      <p className="review-card-comment">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-reviews-note">
                  Certified sacred product from authentic origins. Be the first devotee to share your experience!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

