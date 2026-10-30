'use client';
import { useState } from 'react';
import { useStore } from '@/context/StoreContext';

export default function ProductCard({
  product,
  showDesc = true,
  isSelected = false,
  className = '',
}) {
  const { addToCart, toggleWishlist, isInWishlist, openProductModal } = useStore();
  const { title, catLabel, desc, price, priceOld, save, rating, reviews, badge, img, images = [] } = product;
  const priceNum = parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
  const inWish = isInWishlist(title);

  // Normalize image list for scrolling
  const imgList = (images && images.length > 0)
    ? images
    : (img ? [img] : []);

  const totalImgs = imgList.length;
  const [currentIdx, setCurrentIdx] = useState(0);
  const safeIdx = totalImgs > 0 ? (currentIdx % totalImgs) : 0;
  const currentImg = imgList[safeIdx];

  const badgeMap = { hot: 'badge-hot', new: 'badge-new', lab: 'badge-lab' };
  const badgeTxt = { hot: 'Bestseller', new: 'New Drop', lab: 'Lab Certified' };
  const badgeLabel = product.cert_label || (badge ? badgeTxt[badge] : (product.certification_status === 'certified' ? 'Lab Certified' : null));
  const isInStock = product.is_in_stock !== undefined ? product.is_in_stock : ((product.stock_quantity ?? 1) > 0);

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIdx((prev) => (prev > 0 ? prev - 1 : totalImgs - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIdx((prev) => (prev < totalImgs - 1 ? prev + 1 : 0));
  };

  const handleCardClick = () => {
    openProductModal({ ...product, activeImageIdx: safeIdx }, safeIdx);
  };

  return (
    <article
      className={`prod-card in${isSelected ? ' is-selected' : ''}${className ? ' ' + className : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <div className="prod-img">

        {badgeLabel && <span className={`prod-badge ${badgeMap[badge] || 'badge-lab'}`}>{badgeLabel}</span>}
        <button
          type="button"
          className={`wish${inWish ? ' on' : ''}`}
          aria-label={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product, priceNum);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
        >
          <svg viewBox="0 0 24 24" fill={inWish ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>
          </svg>
        </button>

        {totalImgs > 1 && (
          <>
            <button
              type="button"
              className="prod-img-arrow left"
              aria-label="Previous image"
              onClick={handlePrev}
            >
              ‹
            </button>
            <button
              type="button"
              className="prod-img-arrow right"
              aria-label="Next image"
              onClick={handleNext}
            >
              ›
            </button>
          </>
        )}

        <div className="prod-img-wrap">
          {currentImg && currentImg.startsWith('<') ? (
            <div dangerouslySetInnerHTML={{ __html: currentImg }} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
          ) : (
            <img
              src={currentImg || ''}
              alt={`${title} - view ${safeIdx + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '14px' }}
              loading="lazy"
            />
          )}
        </div>

        {totalImgs > 1 && (
          <div className="prod-img-dots">
            {imgList.map((_, i) => (
              <span
                key={i}
                className={`prod-img-dot${i === safeIdx ? ' active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIdx(i);
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="prod-body">
        <p className="prod-cat">{catLabel}</p>
        <h3 className="prod-title">{title}</h3>
        {showDesc && <p className="prod-desc">{desc}</p>}
        <div className="prod-stars">
          <span className="s">★★★★★</span>
          <span>{rating} · {reviews} reviews</span>
        </div>
        <div className="prod-price">
          <span className="now">{price}</span>
          <span className="was">{priceOld}</span>
          <span className="off">{save}</span>
        </div>
        <div className="prod-actions">
          <button
            type="button"
            className="btn-add"
            disabled={!isInStock}
            style={!isInStock ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            onClick={(e) => {
              e.stopPropagation();
              if (isInStock) {
                addToCart(product, priceNum);
              }
            }}
          >
            {isInStock ? '🛒 Add to Cart' : 'Out of Stock'}
          </button>
          <button
            type="button"
            className="btn-view"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
          >
            View Details
          </button>
        </div>
      </div>
    </article>
  );
}
