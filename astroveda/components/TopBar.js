'use client';
import { useStore } from '@/context/StoreContext';

export default function TopBar({ banners = [], contactLink, contactText }) {
  const { lang, setLang, t } = useStore();
  const hasBanners = banners && banners.length > 0;
  const items = hasBanners
    ? banners.map(b => ({ title: b.title, link: b.link_url }))
    : [
        { title: t('free_shipping', 'Free Shipping on Orders Above ₹999'), link: null },
        { title: t('certified', 'IGI & GIA Certified Gemstones'), link: null },
        { title: t('energised', 'Energised & Authentic Products'), link: null },
      ];

  const waLink = contactLink || 'https://wa.me/919623117545';
  const waLabel = contactText || t('talk_to_guruji', 'Talk to Guruji');

  return (
    <div className="top-bar">
      <div className="tb-left">
        {items.map((it, idx) => (
          it.link ? (
            <a key={idx} href={it.link} style={{ color: 'inherit', textDecoration: 'none' }}>
              <span>{it.title}</span>
            </a>
          ) : (
            <span key={idx}>{it.title}</span>
          )
        ))}
      </div>
      <div className="tb-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Multilingual Switcher Pill (मराठी | हिन्दी | English) */}
        <div
          className="lang-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.35)',
            borderRadius: '16px',
            padding: '2px 3px',
            border: '1px solid rgba(224, 176, 74, 0.3)',
            fontSize: '11px',
          }}
        >
          <button
            type="button"
            onClick={() => setLang('mr')}
            style={{
              background: lang === 'mr' ? 'var(--gold, #e0b04a)' : 'transparent',
              color: lang === 'mr' ? '#000' : 'rgba(255, 255, 255, 0.75)',
              border: 'none',
              borderRadius: '12px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontWeight: lang === 'mr' ? '800' : '500',
              fontSize: '11px',
              transition: 'all 0.15s ease',
            }}
            title="मराठी"
          >
            मराठी
          </button>
          <button
            type="button"
            onClick={() => setLang('hi')}
            style={{
              background: lang === 'hi' ? 'var(--gold, #e0b04a)' : 'transparent',
              color: lang === 'hi' ? '#000' : 'rgba(255, 255, 255, 0.75)',
              border: 'none',
              borderRadius: '12px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontWeight: lang === 'hi' ? '800' : '500',
              fontSize: '11px',
              transition: 'all 0.15s ease',
            }}
            title="हिन्दी"
          >
            हिन्दी
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            style={{
              background: lang === 'en' ? 'var(--gold, #e0b04a)' : 'transparent',
              color: lang === 'en' ? '#000' : 'rgba(255, 255, 255, 0.75)',
              border: 'none',
              borderRadius: '12px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontWeight: lang === 'en' ? '800' : '500',
              fontSize: '11px',
              transition: 'all 0.15s ease',
            }}
            title="English"
          >
            EN
          </button>
        </div>

        <a href={waLink} target="_blank" rel="noopener noreferrer" className="wa">
          {waLabel}
        </a>
      </div>
    </div>
  );
}
