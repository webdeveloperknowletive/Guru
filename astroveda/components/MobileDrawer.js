'use client';
import { useStore } from '@/context/StoreContext';

export default function MobileDrawer() {
  const { drawerOpen, setDrawerOpen, openTracking, openContact } = useStore();

  const handleLinkClick = () => {
    setDrawerOpen(false);
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
    setSearchOpen(true);
  };

  return (
    <>
      <div
        className={`drawer-overlay${drawerOpen ? ' show' : ''}`}
        id="drawerOverlay"
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`mobile-drawer${drawerOpen ? ' open' : ''}`} id="mobileDrawer">
        <button
          className="drawer-close"
          id="drawerClose"
          aria-label="Close navigation drawer"
          onClick={() => setDrawerOpen(false)}
        >
          ✕
        </button>

        <button
          type="button"
          className="drawer-search-btn"
          onClick={handleSearchClick}
          aria-label="Search sacred products and services"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <span>Search products, pujas, gems...</span>
        </button>

        <a href="#jyotish" className="drawer-btn-book" onClick={handleLinkClick}>
          <span>✨ Book Consultation</span>
          <span>→</span>
        </a>
        <ul>
          <li><a href="#top" onClick={handleLinkClick}>Home</a></li>
          <li><a href="#about" onClick={handleLinkClick}>About Guruji</a></li>
          <li><a href="#puja" onClick={handleLinkClick}>Pooja Services</a></li>
          <li><a href="#jyotish" onClick={handleLinkClick}>Astrology Consultation</a></li>
          <li><a href="#rudraksha" onClick={handleLinkClick}>Rudraksha</a></li>
          <li><a href="#yantra" onClick={handleLinkClick}>Yantra</a></li>
          <li><a href="#ratna" onClick={handleLinkClick}>Gemstones</a></li>
          <li><a href="#bracelets" onClick={handleLinkClick}>Bracelets</a></li>
          <li><a href="#ebook" onClick={handleLinkClick}>E-Book</a></li>
          <li>
            <button
              type="button"
              onClick={handleTrackClick}
              style={{ background: 'none', border: 'none', color: 'var(--gold-lt)', font: 'inherit', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}
            >
              📦 Track Order
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleContactClick}
              style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}
            >
              Contact Seva
            </button>
          </li>
        </ul>
      </aside>
    </>
  );
}
