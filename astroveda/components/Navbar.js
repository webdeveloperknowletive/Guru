'use client';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { getAllProducts, adaptApiProduct } from '@/lib/products';
import { getProducts } from '@/lib/api';

const POPULAR_SEARCHES = [
  '5 Mukhi Rudraksha',
  'Emerald · Panna',
  'Shri Yantra',
  'Blue Sapphire',
  'Rudraksha Mala',
  'Navagraha Bracelet',
  'Yellow Sapphire',
  'Kuber Yantra',
];

export default function Navbar({ logo }) {
  const { cartCount, wishlist, setCartOpen, setWishOpen, searchOpen, setSearchOpen, setDrawerOpen, openTracking, openContact, openProductModal, setBrandLogo, t } = useStore();
  const logoSrc = logo || '/swami-guruji-logo-cropped.jpg';

  useEffect(() => {
    if (logo && setBrandLogo) {
      setBrandLogo(logo);
    }
  }, [logo, setBrandLogo]);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [liveProducts, setLiveProducts] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  const openCart = () => { setCartOpen(true); setWishOpen(false); setDropdownOpen(false); setDrawerOpen(false); };
  const openWish = () => { setWishOpen(true); setCartOpen(false); setDropdownOpen(false); setDrawerOpen(false); };

  // Track scroll position to smoothly adapt sticky navbar appearance
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch live products for search lookup
  useEffect(() => {
    getProducts()
      .then(res => {
        if (res?.products) {
          setLiveProducts(res.products.map(adaptApiProduct).filter(Boolean));
        }
      })
      .catch(() => {});
  }, []);

  // Global hotkey: Ctrl+K or Cmd+K to focus search bar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setDropdownOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync with external searchOpen triggers (e.g. from mobile drawer)
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
      setDropdownOpen(true);
      setSearchOpen(false);
    }
  }, [searchOpen, setSearchOpen]);

  // Click outside and Escape key to close search dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  // Filter matching products
  const allProducts = liveProducts.length > 0 ? liveProducts : getAllProducts();
  const q = query.trim().toLowerCase();
  const matches = q
    ? allProducts
        .filter(
          p =>
            p.title.toLowerCase().includes(q) ||
            p.desc.toLowerCase().includes(q) ||
            (p.catLabel && p.catLabel.toLowerCase().includes(q))
        )
        .slice(0, 6)
    : [];

  const handlePickProduct = (product) => {
    setDropdownOpen(false);
    setQuery('');
    openProductModal(product);
  };

  return (
    <nav className={`nav${isScrolled ? ' is-scrolled' : ''}`} id="top">
      <a href="#top" className="brand" aria-label="Swami Guruji Home">
        <img
          src={logoSrc}
          alt="Swami Guruji"
          className="brand-logo-img"
          width={180}
          height={54}
          decoding="async"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/swami-guruji-logo-cropped.jpg'; }}
        />
      </a>

      {/* Nav Links */}
      <ul className="nav-links">
        <li><a href="#top">{t ? t('nav_home', 'Home') : 'Home'}</a></li>
        <li><a href="#about">{t ? t('nav_about', 'About Guruji') : 'About Guruji'}</a></li>
        <li><a href="#puja">{t ? t('nav_puja', 'Pooja Services') : 'Pooja Services'}</a></li>
        <li><a href="#jyotish">{t ? t('nav_jyotish', 'Astrology Consultation') : 'Astrology Consultation'}</a></li>
        <li><a href="#rudraksha">{t ? t('nav_rudraksha', 'Rudraksha') : 'Rudraksha'}</a></li>
        <li><a href="#yantra">{t ? t('nav_yantras', 'Yantra') : 'Yantra'}</a></li>
        <li><a href="#ratna">{t ? t('nav_gemstones', 'Gemstones') : 'Gemstones'}</a></li>
        <li><a href="#bracelets">{t ? t('nav_bracelets', 'Bracelets') : 'Bracelets'}</a></li>
        <li><a href="#ebook">{t ? t('nav_ebook', 'E-Book') : 'E-Book'}</a></li>
      </ul>

      <div className="nav-actions">
        {/* Search Bar in Navbar */}
        <div className="nav-search-bar" ref={searchContainerRef}>
          <svg className="nav-search-bar-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="nav-search-input"
            placeholder={t ? t('search_placeholder', 'Search Rudraksha, Gems, Pujas...') : 'Search Rudraksha, Gems, Pujas...'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            aria-label="Search sacred products and services"
          />
          {query ? (
            <button
              type="button"
              className="nav-search-clear-btn"
              onClick={() => {
                setQuery('');
                searchInputRef.current?.focus();
              }}
              aria-label="Clear query"
            >
              ✕
            </button>
          ) : (
            <kbd className="nav-search-kbd">⌘K</kbd>
          )}

          {/* Floating Dropdown Results directly beneath the search bar */}
          {dropdownOpen && (
            <div className="nav-search-results-dropdown">
              {!q ? (
                <div className="nav-search-suggestions">
                  <span className="nav-search-suggest-title">Popular Searches:</span>
                  <div className="nav-search-chips">
                    {POPULAR_SEARCHES.map(term => (
                      <button
                        key={term}
                        type="button"
                        className="nav-search-chip"
                        onClick={() => {
                          setQuery(term);
                          searchInputRef.current?.focus();
                        }}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : matches.length > 0 ? (
                <div className="nav-search-matches-list">
                  {matches.map(p => (
                    <div
                      key={p.id || p.title}
                      className="nav-search-match-item"
                      onClick={() => handlePickProduct(p)}
                    >
                      <div
                        className="nav-search-match-thumb"
                        dangerouslySetInnerHTML={{ __html: p.img || '' }}
                      />
                      <div className="nav-search-match-info">
                        <div className="nav-search-match-title">{p.title}</div>
                        <div className="nav-search-match-meta">
                          <span className="nav-search-match-cat">{p.catLabel || 'Spiritual'}</span>
                          <span className="nav-search-match-price">{p.price}</span>
                        </div>
                      </div>
                      <span className="nav-search-match-arrow">→</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="nav-search-empty">
                  No products or services found for &quot;{query}&quot;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wishlist Action Button */}
        <button
          className={`icon-btn wish-icon-btn${wishlist.length > 0 ? ' has-items' : ''}`}
          id="wishBtn"
          aria-label={`Wishlist with ${wishlist.length} saved items`}
          title={wishlist.length > 0 ? `Wishlist (${wishlist.length} items)` : 'Saved Wishlist'}
          onClick={openWish}
        >
          <svg viewBox="0 0 24 24" fill={wishlist.length > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>
          </svg>
          {wishlist.length > 0 && <span className="badge wish-badge" id="wishCount">{wishlist.length}</span>}
        </button>

        {/* Cart Action Button */}
        <button
          className={`icon-btn cart-icon-btn${cartCount > 0 ? ' has-items' : ''}`}
          id="cartBtn"
          aria-label={`Cart with ${cartCount} items`}
          title={cartCount > 0 ? `Shopping Cart (${cartCount} items)` : 'Shopping Cart'}
          onClick={openCart}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          {cartCount > 0 && <span className="badge cart-badge" id="cartCount">{cartCount}</span>}
        </button>

        {/* Track Order Button */}
        <button
          type="button"
          onClick={() => openTracking()}
          className="btn-track-nav"
          title="Track your order status"
        >
          <span>📦</span> <span className="btn-track-text">{t ? t('nav_track_order', 'Track Order') : 'Track Order'}</span>
        </button>

        {/* Book Consultation Button */}
        <a href="#jyotish" className="btn-book">{t ? t('book_consultation', 'Book Consultation') : 'Book Consultation'}</a>

        {/* Mobile/Tablet Menu Hamburger Button */}
        <button
          className="icon-btn hamburger"
          id="hamburger"
          aria-label="Toggle Navigation Menu"
          onClick={() => setDrawerOpen(prev => !prev)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
    </nav>
  );
}
