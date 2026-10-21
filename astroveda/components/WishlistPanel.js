'use client';
import { useStore } from '@/context/StoreContext';

export default function WishlistPanel() {
  const {
    wishlist,
    wishOpen,
    setWishOpen,
    removeFromWishlist,
    moveToCart,
  } = useStore();

  return (
    <>
      <div
        className={`panel-overlay${wishOpen ? ' show' : ''}`}
        onClick={() => setWishOpen(false)}
      />
      <aside className={`panel${wishOpen ? ' open' : ''}`} aria-hidden={!wishOpen}>
        <div className="panel-head">
          <h3>
            ❤️ Your Wishlist <span className="count">{wishlist.length}</span>
          </h3>
          <button
            className="panel-close"
            onClick={() => setWishOpen(false)}
            aria-label="Close wishlist"
          >
            ✕
          </button>
        </div>

        <div className="panel-body">
          {wishlist.length === 0 ? (
            <div className="panel-empty">
              <div className="ico">❤️</div>
              <h4>Your wishlist is empty</h4>
              <p>Tap the heart on any product to save it here for later.</p>
            </div>
          ) : (
            wishlist.map((item, index) => (
              <div key={index} className="panel-item">
                <div
                  className="thumb"
                  dangerouslySetInnerHTML={{ __html: item.img || '' }}
                />
                <div className="info">
                  <h4>{item.title}</h4>
                  <div className="price">₹{item.price.toLocaleString('en-IN')}</div>
                  <button
                    className="move-to-cart"
                    onClick={() => moveToCart(index)}
                  >
                    Move to Cart →
                  </button>
                </div>
                <button
                  className="remove"
                  onClick={() => removeFromWishlist(index)}
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
