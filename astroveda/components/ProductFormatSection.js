'use client';
import { useStore } from '@/context/StoreContext';

export default function ProductFormatSection() {
  const { addToCart } = useStore();

  const handleBuyNow = () => {
    addToCart('5 Mukhi Rudraksha', 2499);
  };

  return (
    <section id="format-preview-sec">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">Product Page Example</span>
          <h2>प्रत्येक product मध्ये <em>स्पष्ट माहिती</em></h2>
          <p>आमच्या प्रत्येक product page वर ही सर्व माहिती असते — जेणेकरून तुम्ही माहितीपूर्ण निर्णय घेऊ शकता.</p>
        </div>
        <div className="format-preview reveal">
          <div className="format-visual">
            <span className="badge-float">✓ Lab Certified</span>
            <svg viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="url(#auraGold)" opacity=".5"/>
              <circle cx="100" cy="100" r="58" fill="none" stroke="#e0b04a" strokeWidth="1.6" opacity=".55"/>
              <g fill="#8a5410" stroke="#e0b04a" strokeWidth="1.2">
                <circle cx="100" cy="42" r="11"/><circle cx="130" cy="52" r="11"/><circle cx="152" cy="76" r="11"/>
                <circle cx="158" cy="106" r="11"/><circle cx="148" cy="134" r="11"/><circle cx="126" cy="152" r="11"/>
                <circle cx="100" cy="158" r="11"/><circle cx="74" cy="152" r="11"/><circle cx="52" cy="134" r="11"/>
                <circle cx="42" cy="106" r="11"/><circle cx="48" cy="76" r="11"/><circle cx="70" cy="52" r="11"/>
              </g>
              <text x="100" y="112" textAnchor="middle" fontFamily="'Tiro Devanagari Sanskrit',serif" fontSize="34" fill="#f7dc9a">रु</text>
            </svg>
          </div>
          <div className="format-info">
            <h3>5 Mukhi Rudraksha</h3>
            <div className="price-row">
              <span className="p1">₹2,499</span>
              <span className="p2">₹3,999</span>
              <span className="p3">38% off</span>
            </div>
            <div className="stars">
              ★★★★★ <span style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--sans)', letterSpacing: 0 }}>4.9 · 247 reviews</span>
            </div>
            <p className="lead">नेपाळमधील प्रमाणित स्रोताकडून आणलेले 5 मुखी रुद्राक्ष — कल्याणकारी, शांतिदायक आणि कुटुंबातील सुख-समृद्धीसाठी पारंपरिक महत्त्वाचे.</p>
            <div className="format-details">
              <div className="row"><span className="k">Mukhi</span><span className="v">5</span></div>
              <div className="row"><span className="k">Size</span><span className="v">18 mm</span></div>
              <div className="row"><span className="k">Origin</span><span className="v">Nepal</span></div>
              <div className="row"><span className="k">Certification</span><span className="v">Available</span></div>
            </div>
            <div className="format-section">
              <h5>Traditional Significance</h5>
              <p>5 मुखी रुद्राक्ष कल्याण, शांती आणि सत्याचे प्रतीक आहे. शिवाच्या पाच मुखांचे प्रतिनिधित्व करते.</p>
            </div>
            <div className="format-section">
              <h5>How to Wear</h5>
              <p>सोमवार किंवा शिवरात्रीला सकाळी स्नान करून, तांब्याच्या पात्रात दूध-गंगाजलाने शुद्ध करून, &quot;ॐ ह्रीं नमः&quot; मंत्राने 108 वेळा अभिमंत्रित करून धारण करावे.</p>
            </div>
            <div className="format-section">
              <h5>Mantra</h5>
              <p className="mantra">ॐ ह्रीं नमः</p>
            </div>
            <div className="format-section">
              <h5>Care Instructions</h5>
              <p>पाण्यात भिजवू नका, रासायनिक साबण वापरू नका. महिन्यातून एकदा गंगाजलाने शुद्ध करा.</p>
            </div>
            <div className="format-section">
              <h5>Shipping &amp; Returns</h5>
              <p>48 तासांत डिस्पॅच · 7 दिवसांत easy returns · संपूर्ण भारतात मोफत शिपिंग (₹999 वर).</p>
            </div>
            <div className="format-actions">
              <button className="btn btn-gold" onClick={() => addToCart('5 Mukhi Rudraksha', 2499)}>Add to Cart</button>
              <button className="btn btn-ghost" onClick={handleBuyNow}>Buy Now</button>
            </div>
            <a href="https://wa.me/919000000000" target="_blank" rel="noopener noreferrer" className="format-wa">Need Guidance? WhatsApp Guruji</a>
          </div>
        </div>
      </div>
    </section>
  );
}
