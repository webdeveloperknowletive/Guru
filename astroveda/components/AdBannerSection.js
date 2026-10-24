'use client';
import { useState, useEffect, useRef } from 'react';
import { getAds } from '@/lib/api';

export default function AdBannerSection({ position = 'home_mid', initialAds = null }) {
  const [ads, setAds] = useState(initialAds || []);
  const [loading, setLoading] = useState(!initialAds);
  const containerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function loadActiveAds() {
      try {
        const res = await getAds(position);
        if (mounted) {
          if (res && res.ads && res.ads.length > 0) {
            setAds(res.ads);
          } else {
            setAds([]);
          }
        }
      } catch (err) {
        // Silently fail if offline or backend unavailable
        if (mounted) setAds([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadActiveAds();
    return () => {
      mounted = false;
    };
  }, [position]);

  // If loading or no active ads, render nothing (completely hidden)
  if (loading || !ads || ads.length === 0) {
    return null;
  }

  return (
    <section
      id="sponsored-ad-section"
      className="ad-banner-section"
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '36px auto',
        padding: '0 20px',
        boxSizing: 'border-box',
      }}
    >
      {ads.map((ad) => (
        <AdUnitItem key={ad.id} ad={ad} />
      ))}
    </section>
  );
}

function AdUnitItem({ ad }) {
  const scriptContainerRef = useRef(null);
  const [googleAdLoaded, setGoogleAdLoaded] = useState(false);

  useEffect(() => {
    if (!ad) return;

    // Handle Google AdSense automatic push
    if (ad.platform === 'google' && ad.client_id) {
      try {
        const scriptId = 'google-adsense-script';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.async = true;
          script.crossOrigin = 'anonymous';
          script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ad.client_id)}`;
          document.head.appendChild(script);
        }
        // Push ad unit
        if (typeof window !== 'undefined') {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          setGoogleAdLoaded(true);
        }
      } catch (e) {
        // Handled silently
      }
    }

    // Handle Custom embed script if ad_code is provided
    if (ad.ad_code && scriptContainerRef.current) {
      try {
        // Extract and run scripts in ad_code if present
        const range = document.createRange();
        range.selectNode(scriptContainerRef.current);
        const fragment = range.createContextualFragment(ad.ad_code);
        scriptContainerRef.current.innerHTML = '';
        scriptContainerRef.current.appendChild(fragment);
      } catch (err) {
        // Custom script fallback
      }
    }
  }, [ad]);

  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(135deg, rgba(30, 27, 24, 0.95), rgba(20, 17, 15, 0.98))',
        border: '1px solid rgba(224, 176, 74, 0.25)',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      {/* Sponsored Notice Badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(224, 176, 74, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '10px',
              background: 'rgba(224, 176, 74, 0.15)',
              color: 'var(--gold, #e0b04a)',
              border: '1px solid rgba(224, 176, 74, 0.3)',
            }}
          >
            Sponsored
          </span>
          <span style={{ fontSize: '11px', color: '#a8a29e' }}>
            {ad.platform === 'google' ? 'Google Partner Ads' : ad.platform === 'meta' ? 'Meta Partner' : 'Promotional Partner'}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#78716c' }}>
          Ad
        </div>
      </div>

      {/* 1. Google AdSense Ins Element */}
      {ad.platform === 'google' && ad.client_id && ad.slot_id && (
        <div style={{ minHeight: '90px', width: '100%', textAlign: 'center', overflow: 'hidden' }}>
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={ad.client_id}
            data-ad-slot={ad.slot_id}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      )}

      {/* 2. Custom Embed / Script Container */}
      {ad.ad_code && (
        <div ref={scriptContainerRef} style={{ width: '100%', overflow: 'hidden' }} />
      )}

      {/* 3. Image Banner or Native Sponsored Card */}
      {(!ad.ad_code || ad.platform === 'image_banner' || (ad.platform === 'google' && !ad.slot_id)) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          {ad.image_url && (
            <div style={{ flex: '0 0 auto', maxWidth: '280px', borderRadius: '10px', overflow: 'hidden' }}>
              <img
                src={ad.image_url}
                alt={ad.headline || ad.title}
                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover', borderRadius: '8px' }}
              />
            </div>
          )}

          <div style={{ flex: '1 1 280px' }}>
            {ad.headline && (
              <h4
                style={{
                  fontFamily: 'var(--serif, serif)',
                  fontSize: '18px',
                  color: 'var(--gold-lt, #f3d48b)',
                  margin: '0 0 6px 0',
                }}
              >
                {ad.headline}
              </h4>
            )}
            {ad.description && (
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--ink, #d6d3d1)',
                  margin: '0 0 12px 0',
                  lineHeight: 1.5,
                }}
              >
                {ad.description}
              </p>
            )}
            {ad.target_url && (
              <a
                href={ad.target_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="btn btn-gold"
                style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  padding: '8px 18px',
                  borderRadius: '20px',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                {ad.button_text || 'Learn More'} ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
