export default function CheckoutSection() {
  const steps = [
    { n: '1', title: 'Cart', desc: 'तुमची निवडलेली उत्पादने पहा व verify करा.' },
    { n: '2', title: 'Address', desc: 'Delivery address आणि contact details भरा.' },
    { n: '3', title: 'Payment', desc: 'UPI, Cards, Net Banking, Wallets किंवा COD.' },
    { n: '4', title: 'Confirmation', desc: 'Order ID + WhatsApp + Email/SMS confirmation.' }
  ];

  return (
    <section className="checkout-section">
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">Checkout</span>
          <h2>Simple <em>Checkout</em> Process</h2>
          <p>Cart → Address → Payment → Order Confirmation — फक्त चार सोपे steps.</p>
        </div>
        <div className="checkout-flow">
          {steps.map(s => (
            <div key={s.n} className="checkout-step reveal">
              <span className="n">{s.n}</span>
              <h5>{s.title}</h5>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="payment-methods reveal">
          <span>💳 UPI</span>
          <span>💳 Cards</span>
          <span>🏦 Net Banking</span>
          <span>👛 Wallets</span>
          <span>💵 COD</span>
        </div>
      </div>
    </section>
  );
}
