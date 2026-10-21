'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/context/StoreContext';
import { getWelcomePopup } from '@/lib/api';

export default function WelcomeOfferModal() {
  const {
    couponCode,
    setCouponCode,
    showToast,
    cartOpen,
    wishOpen,
    searchOpen,
    drawerOpen,
    checkoutOpen,
    productModal,
    trackingModal,
    contactModal,
    articleModal,
  } = useStore();

  const [popupConfig, setPopupConfig] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const modalRef = useRef(null);
  const lastActiveElementRef = useRef(null);

  // Check if browser localStorage is functional
  const isStorageAvailable = useCallback(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Fetch published popup settings or draft if preview mode is requested
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isCancelled = false;
    const search = (window.location.search || '').toLowerCase();
    const previewMode =
      search.includes('preview_welcome=true') ||
      search.includes('preview=welcome') ||
      search.includes('preview=true');

    setIsPreview(previewMode);

    getWelcomePopup(previewMode)
      .then((res) => {
        if (!isCancelled && res && res.enabled && res.popup) {
          setPopupConfig(res.popup);
          if (previewMode) {
            // Admin preview bypasses delays and storage
            setTimeout(() => {
              if (!isCancelled) setIsOpen(true);
            }, 200);
          }
        }
      })
      .catch(() => {
        if (!isCancelled) setPopupConfig(null);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Get campaign-specific storage key
  const getStorageKey = useCallback(() => {
    const campId = popupConfig?.campaign_id || 'camp_1';
    return `astroveda_welcome_popup_${campId}`;
  }, [popupConfig]);

  // Check whether this specific campaign has already been seen/dismissed/claimed
  const hasBeenShown = useCallback(() => {
    if (isPreview) return false;
    if (!popupConfig) return false; // Not shown if configuration has not arrived yet

    const key = getStorageKey();
    if (isStorageAvailable()) {
      try {
        const val = window.localStorage.getItem(key);
        return Boolean(val && (val === 'claimed' || val === 'dismissed' || val === 'maybe_later'));
      } catch {
        const val = window.__astroveda_welcome_sessions && window.__astroveda_welcome_sessions[key];
        return Boolean(val && (val === 'claimed' || val === 'dismissed' || val === 'maybe_later'));
      }
    }
    const val = window.__astroveda_welcome_sessions && window.__astroveda_welcome_sessions[key];
    return Boolean(val && (val === 'claimed' || val === 'dismissed' || val === 'maybe_later'));
  }, [isPreview, popupConfig, getStorageKey, isStorageAvailable]);

  // Mark this specific campaign as shown
  const markAsShown = useCallback((status = 'dismissed') => {
    if (isPreview) return; // In preview mode, never pollute visitor tracking storage

    const key = getStorageKey();
    const storedStatus = status === 'claimed' ? 'claimed' : 'dismissed';
    if (isStorageAvailable()) {
      try {
        window.localStorage.setItem(key, storedStatus);
      } catch {
        if (typeof window !== 'undefined') {
          window.__astroveda_welcome_sessions = window.__astroveda_welcome_sessions || {};
          window.__astroveda_welcome_sessions[key] = storedStatus;
        }
      }
    } else if (typeof window !== 'undefined') {
      window.__astroveda_welcome_sessions = window.__astroveda_welcome_sessions || {};
      window.__astroveda_welcome_sessions[key] = storedStatus;
    }
  }, [isPreview, getStorageKey, isStorageAvailable]);

  // Check if current page is excluded (cart, checkout, payment, account routes)
  const isRestrictedPage = useCallback(() => {
    if (isPreview) return false; // Admin preview bypasses page restrictions
    if (typeof window === 'undefined') return false;

    const path = window.location.pathname.toLowerCase();
    const restrictedPrefixes = ['/cart', '/checkout', '/payment', '/account', '/login', '/admin'];
    return restrictedPrefixes.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
  }, [isPreview]);

  // Check if any other modal or drawer is actively open
  const isAnyModalOpen = useCallback(() => {
    if (isPreview) return false;
    return Boolean(
      cartOpen ||
      wishOpen ||
      searchOpen ||
      drawerOpen ||
      checkoutOpen ||
      productModal?.show ||
      trackingModal?.show ||
      contactModal?.show ||
      articleModal?.show
    );
  }, [
    isPreview,
    cartOpen,
    wishOpen,
    searchOpen,
    drawerOpen,
    checkoutOpen,
    productModal?.show,
    trackingModal?.show,
    contactModal?.show,
    articleModal?.show,
  ]);

  // Trigger popup after configured delay for first-time visitors
  useEffect(() => {
    if (isPreview) return; // Preview handles its own instant trigger
    if (!popupConfig || !popupConfig.is_enabled) return;
    if (hasBeenShown()) return;

    const delayMs = Math.max(1, popupConfig.delay_seconds || 5) * 1000;
    const timer = setTimeout(() => {
      if (hasBeenShown()) return;
      if (isRestrictedPage()) return;
      if (isAnyModalOpen()) return;

      if (typeof document !== 'undefined') {
        lastActiveElementRef.current = document.activeElement;
      }
      setIsOpen(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [isPreview, popupConfig, hasBeenShown, isRestrictedPage, isAnyModalOpen]);

  // Scroll lock & keyboard focus management
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelector('button, [href], input, [tabindex="0"]');
        if (focusable) focusable.focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss('escape');
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);

      if (lastActiveElementRef.current && typeof lastActiveElementRef.current.focus === 'function') {
        try {
          lastActiveElementRef.current.focus();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen]);

  const handleDismiss = (status = 'dismissed') => {
    if (isPreview) {
      setIsOpen(false);
      showToast('Admin preview closed (no storage or coupon state was changed)');
      return;
    }
    markAsShown(status);
    setIsOpen(false);
  };

  const handleActionClick = () => {
    if (isPreview) {
      setIsOpen(false);
      showToast('Admin preview: button action clicked (visitor tracking & coupons paused)');
      return;
    }

    markAsShown('claimed');
    setIsOpen(false);

    if (popupConfig?.button_action === 'open_link' && popupConfig?.target_url) {
      const url = popupConfig.target_url;
      showToast('Exploring our sacred collection ✨');
      if (url.startsWith('#')) {
        const elem = document.querySelector(url);
        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.location.href = url;
      }
      return;
    }

    // Default: claim coupon
    const code = popupConfig?.coupon_code || 'WELCOME10';
    if (!couponCode || couponCode === code) {
      setCouponCode(code);
      showToast(`Your welcome offer is ready. Apply ${code} at checkout.`);
    } else {
      showToast(`Welcome offer ready! Active coupon: ${couponCode}. Use code ${code} at checkout.`);
    }
  };

  const handleCopyCode = async () => {
    const code = popupConfig?.coupon_code || 'WELCOME10';
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const input = document.createElement('input');
        input.value = code;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      showToast(`Coupon code ${code} copied!`);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast(`Coupon code: ${code}`);
    }
  };

  if (!isOpen || !popupConfig) return null;

  const heading = popupConfig.heading || 'Your Cosmic Welcome';
  const description = popupConfig.description || 'Enjoy a special offer on your first order.';
  const highlight = popupConfig.offer_highlight || '10% OFF';
  const coupon = popupConfig.coupon_code || 'WELCOME10';
  const buttonLabel = popupConfig.button_label || 'Claim My Offer';
  const terms = popupConfig.terms || '*Valid on eligible items on your first order. Cannot be combined with other offers. Discount verified on checkout.';
  const imageUrl = popupConfig.image_url || '/hero/hero-astrology.jpg';
  const imageAlt = popupConfig.image_alt || 'Cosmic Vedic Astrology Welcome Offer';
  const imagePosition = popupConfig.image_position || 'center';

  return (
    <div
      className="pd-modal-overlay show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-offer-heading"
      aria-describedby="welcome-offer-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss('backdrop_click');
      }}
      style={{
        zIndex: 1100,
        backgroundColor: 'rgba(5, 2, 4, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        ref={modalRef}
        className="pd-modal welcome-popup-card"
        style={{
          position: 'relative',
          maxWidth: '680px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 260px) 1fr',
          padding: 0,
          background: 'linear-gradient(155deg, rgba(32, 14, 22, 0.98) 0%, rgba(14, 6, 11, 0.99) 100%)',
          border: '1px solid var(--gold)',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.88), 0 0 32px rgba(224, 176, 74, 0.22)',
          overflow: 'hidden',
          animation: 'fadeInUp 0.35s ease-out forwards',
        }}
      >
        {/* Admin Preview Header Badge */}
        {isPreview && (
          <div
            style={{
              gridColumn: '1 / -1',
              background: 'linear-gradient(90deg, #0284c7, #0369a1)',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '600',
              padding: '6px 12px',
              textAlign: 'center',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>👁️</span>
            <span>Admin Preview Mode — Draft settings active (visitor tracking & coupon redemption paused)</span>
          </div>
        )}

        {/* Visible Close Button */}
        <button
          type="button"
          className="pd-close"
          onClick={() => handleDismiss('close_button')}
          aria-label="Close welcome offer popup"
          style={{
            position: 'absolute',
            top: isPreview ? '38px' : '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(224, 176, 74, 0.35)',
            color: 'var(--gold-lt)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 15,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(224, 176, 74, 0.25)';
            e.currentTarget.style.color = 'var(--gold)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'var(--gold-lt)';
          }}
        >
          ✕
        </button>

        {/* Column 1 (Left on desktop, Top on mobile): Astrology Banner Image */}
        <div
          className="welcome-popup-image-col"
          style={{
            position: 'relative',
            minHeight: '260px',
            background: '#12080d',
            overflow: 'hidden',
          }}
        >
          <img
            src={imageUrl}
            alt={imageAlt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: imagePosition,
              display: 'block',
            }}
            onError={(e) => {
              e.currentTarget.src = '/hero/hero-astrology.jpg';
            }}
          />
          {/* Subtle cosmic vignette gradient overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to right, rgba(14,6,11,0.1), rgba(14,6,11,0.65))',
              pointerEvents: 'none',
            }}
          />
          {/* Floating Astrology Glyph Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: 'rgba(10, 5, 8, 0.75)',
              border: '1px solid rgba(224, 176, 74, 0.3)',
              borderRadius: '20px',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <span style={{ fontSize: '12px' }}>🕉️</span>
            <span style={{ fontSize: '10px', color: 'var(--gold-lt)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              AstroVeda
            </span>
          </div>
        </div>

        {/* Column 2 (Right on desktop, Bottom on mobile): Offer Content */}
        <div
          className="welcome-popup-offer-col"
          style={{
            padding: 'clamp(20px, 3.5vw, 32px) clamp(18px, 3vw, 28px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'left',
          }}
        >
          {/* Kicker & Highlight Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span
              className="kicker"
              style={{
                color: 'var(--gold)',
                fontSize: '10px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              शुभ स्वागतम् · Welcome Gift
            </span>
            {highlight && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--ink)',
                  background: 'linear-gradient(135deg, var(--gold), var(--gold-lt))',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(224,176,74,0.3)',
                }}
              >
                {highlight}
              </span>
            )}
          </div>

          {/* Heading */}
          <h2
            id="welcome-offer-heading"
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(18px, 2.5vw, 22px)',
              color: 'var(--gold-lt)',
              fontWeight: '600',
              lineHeight: 1.25,
              marginBottom: '8px',
            }}
          >
            {heading}
          </h2>

          {/* Description */}
          <p
            id="welcome-offer-desc"
            style={{
              fontSize: '13px',
              color: 'var(--cream)',
              lineHeight: 1.45,
              marginBottom: '16px',
            }}
          >
            {description}
          </p>

          {/* Coupon Code Pill */}
          {coupon && (
            <div
              style={{
                background: 'rgba(224, 176, 74, 0.08)',
                border: '1px dashed var(--gold)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '9px',
                    color: 'var(--muted)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  Coupon Code
                </span>
                <span
                  style={{
                    fontFamily: 'var(--serif)',
                    fontSize: '15px',
                    fontWeight: '700',
                    color: 'var(--gold-lt)',
                    letterSpacing: '1.5px',
                  }}
                >
                  {coupon}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                aria-label={`Copy coupon code ${coupon}`}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  borderRadius: '5px',
                  border: '1px solid rgba(224, 176, 74, 0.4)',
                  background: copied ? 'var(--gold)' : 'rgba(255, 255, 255, 0.06)',
                  color: copied ? 'var(--ink)' : 'var(--gold-lt)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          )}

          {/* Buttons: Primary CTA & Maybe Later */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <button
              type="button"
              className="btn btn-gold"
              onClick={handleActionClick}
              style={{
                width: '100%',
                padding: '11px 18px',
                fontSize: '13px',
                fontWeight: '700',
                letterSpacing: '0.5px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(224, 176, 74, 0.25)',
                textAlign: 'center',
              }}
            >
              {buttonLabel}
            </button>

            <button
              type="button"
              onClick={() => handleDismiss('maybe_later')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '11px',
                padding: '4px 8px',
                cursor: 'pointer',
                textAlign: 'center',
                textDecoration: 'underline',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cream)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              Maybe Later
            </button>
          </div>

          {/* Terms & Conditions */}
          {terms && (
            <p
              style={{
                fontSize: '10px',
                color: 'var(--muted-2)',
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {terms}
            </p>
          )}
        </div>
      </div>

      {/* Scoped CSS for Two-Column Responsive Layout */}
      <style jsx>{`
        @media (max-width: 640px) {
          .welcome-popup-card {
            grid-template-columns: 1fr !important;
            max-width: 360px !important;
          }
          .welcome-popup-image-col {
            height: 150px !important;
            min-height: 150px !important;
          }
        }
      `}</style>
    </div>
  );
}
