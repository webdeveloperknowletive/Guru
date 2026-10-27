'use client';
import { useStore } from '@/context/StoreContext';

export default function MobileDrawer() {
  const { drawerOpen, setDrawerOpen, setSearchOpen, openTracking, openContact, brandLogo, lang, setLang, t } = useStore();

  const handleLinkClick = () => {
    setDrawerOpen(false);
  };

  const handleHomeClick = (e) => {
    setDrawerOpen(false);
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/' || window.location.pathname === '') {
        e.preventDefault();
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        if (window.location.hash) {
          try {
            history.pushState(null, '', window.location.pathname);
          } catch {
            window.location.hash = '';
          }
        }
      }
    }
  };

  const handleTrackClick = () => {
    setDrawerOpen(false);
    openTracking();
  };

  const handleContactClick = () => {
    setDrawerOpen(false);
    openContact();
  };

  const handleSearchClick = () => {
    setDrawerOpen(false);
    if (setSearchOpen) setSearchOpen(true);
  };

  return (
    <>
      <div
        className={`drawer-overlay${drawerOpen ? ' show' : ''}`}
        id="drawerOverlay"
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`mobile-drawer${drawerOpen ? ' open' : ''}`} id="mobileDrawer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px 16px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <a href="/" onClick={handleHomeClick} style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src={brandLogo || '/swami-guruji-logo-cropped.jpg'}
              alt="Swami Guruji"
              style={{ maxHeight: '38px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/swami-guruji-logo-cropped.jpg'; }}
            />
          </a>
          <button
            className="drawer-close"
            id="drawerClose"
            aria-label="Close navigation drawer"
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'static', margin: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Mobile Language Switcher Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 16px', background: 'rgba(212, 175, 55, 0.06)', borderBottom: '1px solid rgba(212, 175, 55, 0.12)' }}>
          <span style={{ fontSize: '11px', color: 'var(--gold-lt)', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🌐 भाषा:</span>
          {[
            { code: 'mr', label: 'मराठी' },
            { code: 'hi', label: 'हिन्दी' },
            { code: 'en', label: 'EN' },
          ].map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang && setLang(code)}
              style={{
                background: (lang || 'mr') === code ? 'var(--gold, #d4af37)' : 'transparent',
                color: (lang || 'mr') === code ? '#000' : 'rgba(255,255,255,0.85)',
                border: (lang || 'mr') === code ? '1px solid var(--gold, #d4af37)' : '1px solid rgba(212,175,55,0.25)',
                borderRadius: '12px',
                padding: '2px 10px',
                fontSize: '11px',
                fontWeight: (lang || 'mr') === code ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="drawer-search-btn"
          onClick={handleSearchClick}
          aria-label="Search sacred products and services"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <span>{t ? t('search_placeholder', 'Search products, pujas, gems...') : 'Search products, pujas, gems...'}</span>
        </button>

        <a href="#jyotish" className="drawer-btn-book" onClick={handleLinkClick}>
          <span>✨ {t ? t('book_consultation', 'Book Consultation') : 'Book Consultation'}</span>
          <span>→</span>
        </a>
        <ul>
          <li><a href="/" onClick={handleHomeClick}>{t ? t('nav_home', 'Home') : 'Home'}</a></li>
          <li><a href="#about" onClick={handleLinkClick}>{t ? t('nav_about', 'About Guruji') : 'About Guruji'}</a></li>
          <li><a href="#puja" onClick={handleLinkClick}>{t ? t('nav_puja', 'Pooja Services') : 'Pooja Services'}</a></li>
          <li><a href="#jyotish" onClick={handleLinkClick}>{t ? t('nav_jyotish', 'Astrology Consultation') : 'Astrology Consultation'}</a></li>
          <li><a href="#rudraksha" onClick={handleLinkClick}>{t ? t('nav_rudraksha', 'Rudraksha') : 'Rudraksha'}</a></li>
          <li><a href="#yantra" onClick={handleLinkClick}>{t ? t('nav_yantras', 'Yantra') : 'Yantra'}</a></li>
          <li><a href="#ratna" onClick={handleLinkClick}>{t ? t('nav_gemstones', 'Gemstones') : 'Gemstones'}</a></li>
          <li><a href="#bracelets" onClick={handleLinkClick}>{t ? t('nav_bracelets', 'Bracelets') : 'Bracelets'}</a></li>
          <li><a href="#ebook" onClick={handleLinkClick}>{t ? t('nav_ebook', 'E-Book') : 'E-Book'}</a></li>
          <li>
            <button
              type="button"
              onClick={handleTrackClick}
              style={{ background: 'none', border: 'none', color: 'var(--gold-lt)', font: 'inherit', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}
            >
              📦 {t ? t('nav_track_order', 'Track Order') : 'Track Order'}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleContactClick}
              style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}
            >
              {t ? t('quick_contact', 'Contact Seva') : 'Contact Seva'}
            </button>
          </li>
        </ul>
      </aside>
    </>
  );
}
