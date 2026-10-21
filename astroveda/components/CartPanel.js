'use client';
import { useStore } from '@/context/StoreContext';

export default function CartPanel() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    cartCount,
    cartSubtotal,
    updateCartQty,
    removeFromCart,
    openCheckout,
    serverCart,
  } = useStore();

  return (
    <>
      <div
        className={`panel-overlay${cartOpen ? ' show' : ''}`}
        onClick={() => setCartOpen(false)}
      />
      <aside className={`panel${cartOpen ? ' open' : ''}`} aria-hidden={!cartOpen}>
        <div className="panel-head">
          <h3>
            🛒 Your Cart <span className="count">{cartCount}</span>
          </h3>
          <button
            className="panel-close"
            onClick={() => setCartOpen(false)}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        <div className="panel-body">
          {cart.length === 0 ? (
            <div className="panel-empty">
              <div className="ico">🛒</div>
              <h4>Your cart is empty</h4>
              <p>Browse our collection and add something sacred to your cart.</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="panel-item">
                <div
                  className="thumb"
                  dangerouslySetInnerHTML={{ __html: item.img || '' }}
                />
                <div className="info">
                  <h4>{item.title}</h4>
                  <div className="price">₹{item.price.toLocaleString('en-IN')}</div>
                  <div className="qty">
                    <button onClick={() => updateCartQty(index, -1)}>−</button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateCartQty(index, 1)}>+</button>
                  </div>
                </div>
                <button
                  className="remove"
                  onClick={() => removeFromCart(index)}
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="panel-foot">
            <div className="subtotal">
              <span>Subtotal</span>
              <b>₹{cartSubtotal.toLocaleString('en-IN')}</b>
            </div>
            <button
              className="btn-checkout"
              onClick={openCheckout}
            >
              Proceed to Checkout →
            </button>
            <button
              className="keep-shopping"
              onClick={() => setCartOpen(false)}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
