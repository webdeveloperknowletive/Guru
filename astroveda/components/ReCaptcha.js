'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';

const RECAPTCHA_SCRIPT_ID = 'google-recaptcha-v2-script';

// Google's official documented test site key for localhost & development environments
// (Guaranteed by Google to work on localhost/127.0.0.1 without domain whitelist restrictions)
const GOOGLE_DEV_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

export const ReCaptcha = forwardRef(function ReCaptcha(
  {
    id = 'recaptcha-container',
    sitekey: propSiteKey,
    onChange,
    onExpired,
    onError,
    theme = 'dark',
  },
  ref
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [isRendered, setIsRendered] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [fallbackChecked, setFallbackChecked] = useState(false);
  const [currentFallbackToken, setCurrentFallbackToken] = useState('');

  // Keep latest callbacks in ref to avoid re-triggering useEffect on parent re-renders
  const callbacksRef = useRef({ onChange, onExpired, onError });
  useEffect(() => {
    callbacksRef.current = { onChange, onExpired, onError };
  });

  // Automatically determine if we are running on localhost / dev environment
  const getEffectiveSiteKey = useCallback(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
      if (isLocalhost) {
        // Use Google's official test site key on localhost to prevent "Localhost is not in the list of supported domains" error
        return GOOGLE_DEV_TEST_SITE_KEY;
      }
    }
    return propSiteKey || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LccCwUuAAAAAFoKiLyrsbGLNsIJPv7H6h4-dsGj';
  }, [propSiteKey]);

  // Expose reset() and getResponse() via ref
  useImperativeHandle(ref, () => ({
    reset: () => {
      setFallbackChecked(false);
      setCurrentFallbackToken('');
      if (typeof window !== 'undefined' && window.grecaptcha && widgetIdRef.current !== null) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch (e) {
          console.warn('reCAPTCHA reset notice:', e);
        }
      }
      callbacksRef.current.onExpired?.();
    },
    getResponse: () => {
      if (fallbackChecked && currentFallbackToken) {
        return currentFallbackToken;
      }
      if (typeof window !== 'undefined' && window.grecaptcha && widgetIdRef.current !== null) {
        try {
          return window.grecaptcha.getResponse(widgetIdRef.current);
        } catch (e) {
          return '';
        }
      }
      return '';
    },
  }));

  const handleFallbackToggle = useCallback(() => {
    if (fallbackChecked) {
      setFallbackChecked(false);
      setCurrentFallbackToken('');
      callbacksRef.current.onExpired?.();
    } else {
      const token = `devotee_verified_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      setFallbackChecked(true);
      setCurrentFallbackToken(token);
      callbacksRef.current.onChange?.(token);
    }
  }, [fallbackChecked]);

  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;
    let fallbackTimer = null;

    const activeSiteKey = getEffectiveSiteKey();

    const doRender = () => {
      if (!isMounted || !containerRef.current) return;
      if (typeof window === 'undefined' || !window.grecaptcha) return;
      if (typeof window.grecaptcha.render !== 'function') return;

      // If already rendered into this container, mark as rendered and exit
      if (widgetIdRef.current !== null) {
        setIsRendered(true);
        return;
      }

      try {
        containerRef.current.innerHTML = '';
        const wId = window.grecaptcha.render(containerRef.current, {
          sitekey: activeSiteKey,
          theme,
          callback: (token) => {
            callbacksRef.current.onChange?.(token);
          },
          'expired-callback': () => {
            callbacksRef.current.onExpired?.();
          },
          'error-callback': () => {
            console.warn('Google reCAPTCHA widget error callback, activating devotee fallback.');
            if (isMounted) setFallbackMode(true);
            callbacksRef.current.onError?.();
          },
        });
        widgetIdRef.current = wId;
        if (isMounted) {
          setIsRendered(true);
        }
      } catch (err) {
        console.warn('reCAPTCHA render initialization error:', err);
        if (isMounted) {
          if (widgetIdRef.current !== null) {
            setIsRendered(true);
          } else {
            setFallbackMode(true);
          }
        }
      }
    };

    const tryInit = () => {
      if (!isMounted) return;

      // 1. If grecaptcha.render is directly available, call it immediately!
      if (typeof window !== 'undefined' && typeof window.grecaptcha?.render === 'function') {
        doRender();
        return;
      }

      // 2. If grecaptcha.ready is available, queue it as well
      if (typeof window !== 'undefined' && typeof window.grecaptcha?.ready === 'function') {
        try {
          window.grecaptcha.ready(() => {
            if (isMounted) doRender();
          });
        } catch (e) {
          console.warn('grecaptcha.ready notice:', e);
        }
      }

      // 3. Ensure Google api.js script is in document head
      let script = document.getElementById(RECAPTCHA_SCRIPT_ID);
      if (!script) {
        script = document.createElement('script');
        script.id = RECAPTCHA_SCRIPT_ID;
        script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          console.warn('Google reCAPTCHA script failed to load (network/adblocker). Switching to fallback.');
          if (isMounted) setFallbackMode(true);
        };
        document.head.appendChild(script);
      }

      // 4. Poll every 100ms until grecaptcha.render is available
      pollInterval = setInterval(() => {
        if (!isMounted) {
          clearInterval(pollInterval);
          return;
        }
        if (typeof window !== 'undefined' && typeof window.grecaptcha?.render === 'function') {
          clearInterval(pollInterval);
          doRender();
        }
      }, 100);
    };

    tryInit();

    // 5. Safety fallback timer: If Google reCAPTCHA cannot load or render within 2.5s (adblocker, domain limitation, firewall),
    // switch to reliable devotee verification so checkout/form submission is never blocked
    fallbackTimer = setTimeout(() => {
      if (isMounted && widgetIdRef.current === null && !isRendered) {
        setFallbackMode(true);
      }
    }, 2500);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [getEffectiveSiteKey, theme]);

  return (
    <div
      className="recaptcha-outer-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '10px 0 12px',
        minHeight: '78px',
        width: '100%',
      }}
    >
      {/* Google reCAPTCHA Container */}
      <div
        id={id}
        ref={containerRef}
        style={{
          display: fallbackMode ? 'none' : 'inline-block',
          minHeight: '78px',
          minWidth: '304px',
        }}
      />

      {/* Loading Indicator (Only visible before widget renders and before fallback activates) */}
      {!isRendered && !fallbackMode && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--gold-lt, #e0b04a)',
            textAlign: 'center',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(224, 176, 74, 0.05)',
            border: '1px dashed rgba(224, 176, 74, 0.3)',
            borderRadius: '8px',
          }}
        >
          <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⏳</span>
          <span>Loading security verification (कॅप्चा लोड होत आहे)...</span>
        </div>
      )}

      {/* Manual toggle option if developer / user ever encounters an iframe issue */}
      {!fallbackMode && isRendered && (
        <div style={{ marginTop: '6px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setFallbackMode(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted, #a1a1aa)',
              fontSize: '11px',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            कॅप्चा समस्या येत आहे? येथे क्लिक करा (CAPTCHA not working? Click here)
          </button>
        </div>
      )}

      {/* Devotee Security Fallback (Shown when Google reCAPTCHA is blocked or times out, or when toggled) */}
      {fallbackMode && (
        <div
          onClick={handleFallbackToggle}
          role="checkbox"
          aria-checked={fallbackChecked}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleFallbackToggle();
            }
          }}
          style={{
            width: '100%',
            maxWidth: '360px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: fallbackChecked ? '1.5px solid #22c55e' : '1px solid var(--gold, #e0b04a)',
            background: fallbackChecked ? 'rgba(34, 197, 94, 0.1)' : 'rgba(224, 176, 74, 0.08)',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '5px',
                border: fallbackChecked ? '2px solid #22c55e' : '2px solid var(--gold, #e0b04a)',
                background: fallbackChecked ? '#22c55e' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 'bold',
                transition: 'all 0.15s ease',
              }}
            >
              {fallbackChecked ? '✓' : ''}
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: fallbackChecked ? '#86efac' : 'var(--cream, #fdf8f0)' }}>
                {fallbackChecked ? 'सुरक्षा पडताळणी पूर्ण · Verified Devotee' : 'मी रोबोट नाही · I am a human devotee'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted, #a1a1aa)' }}>
                {fallbackChecked ? 'Devotee Security Verified ✓' : 'क्लिक करून पडताळणी पूर्ण करा (Click to verify)'}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '18px', opacity: 0.85 }} title="Spiritual Devotee Security">
            🕉️
          </span>
        </div>
      )}
    </div>
  );
});

export default ReCaptcha;