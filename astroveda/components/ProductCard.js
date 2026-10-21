'use client';
import { useStore } from '@/context/StoreContext';

export default function ProductCard({ product, showDesc = true }) {
  const { addToCart, toggleWishlist, isInWishlist, openProductModal } = useStore();
  const { title, catLabel, desc, price, priceOld, save, rating, reviews, badge, img } = product;
  const priceNum = parseInt(price.replace(/[^\d]/g, ''), 10) || 0;
  const inWish = isInWishlist(title);

  const badgeMap = { hot: 'badge-hot', new: 'badge-new', lab: 'badge-lab' };
  const badgeTxt = { hot: 'Bestseller', new: 'New Drop', lab: 'Lab Certified' };

  return (
    <article className="prod-card in">
      <div className="prod-img">
        {badge && <span className={`prod-badge ${badgeMap[badge]}`}>{badgeTxt[badge]}</span>}
        <button
          className={`wish${inWish ? ' on' : ''}`}
          aria-label="Add to wishlist"
          onClick={() => toggleWishlist(product, priceNum)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>
          </svg>
        </button>
        <div className="prod-img-wrap" dangerouslySetInnerHTML={{ __html: img }} />
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
          <button className="btn-add" onClick={() => addToCart(product, priceNum)}>🛒 Add to Cart</button>
          <button className="btn-view" onClick={() => openProductModal(product)}>View Details</button>
        </div>
      </div>
    </article>
  );
}
