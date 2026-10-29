'use client';
import { useStore } from '@/context/StoreContext';

export default function Footer({ logo, footerText }) {
  const { openContact, openTracking } = useStore();
  const logoSrc = logo || '/swami-guruji-logo-cropped.jpg';

  const brandDesc = footerText?.brand_desc || 'परंपरेतून मार्गदर्शन, श्रद्धेतून समाधान. 25 वर्षांहून अधिक अनुभव — पूजा, ज्योतिष, रत्न, रुद्राक्ष, यंत्र आणि ब्रेसलेट.';
  const shloka = footerText?.shloka || '॥ सर्वे भवन्तु सुखिनः ॥';
  const waUrl = footerText?.whatsapp_url || 'https://wa.me/919000000000';

  return (
    <footer id="contact">
      <div className="foot-grid">
        <div className="foot-brand">
          <a href="#top" className="brand" aria-label="Swami Guruji">
            <img
              src={logoSrc}
              alt="Swami Guruji"
              className="brand-logo-img"
              width={180}
              height={54}
              loading="lazy"
              decoding="async"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/swami-guruji-logo-cropped.jpg'; }}
            />
          </a>
          <p>
            {brandDesc}
          </p>
          <div className="foot-social">
            <a href="#" aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </a>
            <a href="#" aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
            </a>
            <a href="#" aria-label="YouTube">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22.5 6.5a2.8 2.8 0 00-2-2C18.8 4 12 4 12 4s-6.8 0-8.5.5a2.8 2.8 0 00-2 2A29 29 0 001 12a29 29 0 00.5 5.5 2.8 2.8 0 002 2C5.2 20 12 20 12 20s6.8 0 8.5-.5a2.8 2.8 0 002-2A29 29 0 0023 12a29 29 0 00-.5-5.5z" />
                <polygon points="10 8 16 12 10 16" />
              </svg>
            </a>
            <a href={waUrl} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.2-.7.2-.8 1-1 1.2-.4.3-.7.1a8 8 0 01-2.4-1.5 9 9 0 01-1.6-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-1-2.4c-.2-.6-.5-.5-.7-.5H7a1.4 1.4 0 00-1 .5 4.3 4.3 0 00-1.3 3.2 7.4 7.4 0 001.6 4 17 17 0 006.6 5.8c.9.4 1.6.6 2.2.8a5.3 5.3 0 002.4.1 4 4 0 002.6-1.8 3.2 3.2 0 00.2-1.8c-.1-.2-.3-.3-.6-.4zM12 22a10 10 0 01-5.1-1.4L2 22l1.4-4.8A10 10 0 1112 22z" />
              </svg>
            </a>
          </div>
          <p className="dev">{shloka}</p>
        </div>
        <div className="foot-col">
          <h5>Quick Links</h5>
          <ul>
            <li><a href="#top">Home</a></li>
            <li><a href="#shop">Shop</a></li>
            <li><a href="#puja">Puja Services</a></li>
            <li><a href="#jyotish">Jyotish Consultation</a></li>
            <li><a href="#about">About</a></li>
            <li>
              <button
                type="button"
                onClick={openContact}
                style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                Contact Us
              </button>
            </li>
          </ul>
        </div>
        <div className="foot-col">
          <h5>Customer Support</h5>
          <ul>
            <li>
              <button
                type="button"
                onClick={() => openTracking()}
                style={{ background: 'none', border: 'none', color: 'var(--gold-lt)', font: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 600 }}
              >
                📦 Track Your Order
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (typeof window !== 'undefined' && window.openDpdpPolicy) {
                    window.openDpdpPolicy('return');
                  } else {
                    openTracking();
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                🔄 Sacred Return &amp; Refund Policy
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (typeof window !== 'undefined' && window.openDpdpPolicy) {
                    window.openDpdpPolicy('privacy');
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                🛡️ Privacy Policy (DPDP Act)
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (typeof window !== 'undefined' && window.openDpdpPolicy) {
                    window.openDpdpPolicy('cookies');
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                ⚙️ Cookie Preferences
              </button>
            </li>
            <li><a href="#about">About Spiritual Consecration</a></li>
          </ul>
        </div>
        <div className="foot-col">
          <h5>Connect</h5>
          <ul>
            <li><a href="#">📷 Instagram</a></li>
            <li><a href="#">📘 Facebook</a></li>
            <li><a href="https://wa.me/919623117545" target="_blank" rel="noopener noreferrer">📲 WhatsApp</a></li>
          </ul>
        </div>
      </div>
      <div className="foot-back-to-top">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="foot-back-to-top-btn"
          aria-label="Back to top of page"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <span>Back to Top ↑</span>
        </button>
      </div>
      <div className="foot-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span>© 2026 Swami Guruji · परंपरेतून मार्गदर्शन · श्रद्धेतून समाधान (DPDP Act, 2023 India Compliant)</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.openDpdpPolicy && window.openDpdpPolicy('privacy')}
            style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.65)', cursor: 'pointer', padding: 0, fontSize: '12px' }}
          >
            Privacy Policy
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.openDpdpPolicy && window.openDpdpPolicy('return')}
            style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.65)', cursor: 'pointer', padding: 0, fontSize: '12px' }}
          >
            Return Policy
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.openDpdpPolicy && window.openDpdpPolicy('cookies')}
            style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.65)', cursor: 'pointer', padding: 0, fontSize: '12px' }}
          >
            Cookie Settings
          </button>
        </div>
        <span>॥ कालः क्रीडति गच्छति ॥</span>
      </div>
    </footer>
  );
}
