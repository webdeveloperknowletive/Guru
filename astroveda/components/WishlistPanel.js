'use client';
import { useStore } from '@/context/StoreContext';

export default function WishlistPanel() {
  const {
    wishlist,
    wishOpen,
    setWishOpen,
    cart,
    cartCount,
    setCartOpen,
    removeFromWishlist,
    moveToCart,
    addToCart,
  } = useStore();

  return (
    <>
      <div
        className={`panel-overlay${wishOpen ? ' show' : ''}`}
        onClick={() => setWishOpen(false)}
      />
      <aside className={`panel${wishOpen ? ' open' : ''}`} aria-hidden={!wishOpen}>
        <div className="panel-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="panel-tab-btn active"
              style={{
                background: 'rgba(224, 176, 74, 0.2)',
                border: '1px solid rgba(224, 176, 74, 0.5)',
                color: '#f7dc9a',
                padding: '6px 12px',
                borderRadius: '99px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ❤️ Wishlist <span className="count">{wishlist.length}</span>
            </button>

            <button
              type="button"
              className="panel-tab-btn"
              onClick={() => {
                setWishOpen(false);
                setCartOpen(true);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--muted, #aaa)',
                padding: '6px 12px',
                borderRadius: '99px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              title="Switch to Shopping Cart"
            >
              🛒 Cart <span className="count">{cartCount}</span>
            </button>
          </div>

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
              <p>Tap the heart on any product to save it to your wishlist.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px', width: '100%', maxWidth: '280px' }}>
                {cartCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-gold"
                    onClick={() => {
                      setWishOpen(false);
                      setCartOpen(true);
                    }}
                    style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 700, width: '100%' }}
                  >
                    🛒 View Your Cart ({cartCount} {cartCount === 1 ? 'item' : 'items'})
                  </button>
                )}
                <a
                  href="#shop"
                  onClick={() => setWishOpen(false)}
                  className="btn btn-ghost"
                  style={{ padding: '10px 16px', fontSize: '13px', textAlign: 'center', width: '100%' }}
                >
                  ✨ Explore Products & Add to Cart →
                </a>
              </div>
            </div>
          ) : (
            wishlist.map((item, index) => (
              <div key={item.id || index} className="panel-item">
                <div className="thumb">
                  {item.img && typeof item.img === 'string' && item.img.startsWith('<') ? (
                    <div dangerouslySetInnerHTML={{ __html: item.img }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <img
                      src={item.img || '/categories/rudraksha.png'}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                    />
                  )}
                </div>
                <div className="info">
                  <h4>{item.title}</h4>
                  <div className="price">₹{Number(item.price).toLocaleString('en-IN')}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-add-to-cart-wish"
                      onClick={() => {
                        addToCart(item, item.price);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #e0b04a, #d49339)',
                        color: '#1a0b10',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      🛒 Add to Cart
                    </button>
                    <button
                      type="button"
                      className="move-to-cart"
                      onClick={() => moveToCart(index)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: 'transparent',
                        color: 'var(--gold, #e0b04a)',
                        border: '1px solid rgba(224, 176, 74, 0.4)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Move to Cart →
                    </button>
                  </div>
                </div>
                <button
                  type="button"
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

        {wishlist.length > 0 && (
          <div className="panel-foot" style={{ padding: '16px 20px', borderTop: '1px solid var(--line)', display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-gold"
              style={{ flex: 1, padding: '12px', fontSize: '13px', fontWeight: 700 }}
              onClick={() => {
                wishlist.forEach(item => addToCart(item, item.price));
                setWishOpen(false);
                setCartOpen(true);
              }}
            >
              🛒 Add All to Cart ({wishlist.length})
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
