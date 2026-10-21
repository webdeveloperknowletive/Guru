'use client';

import { useState, useEffect, useMemo } from 'react';

const DEFAULT_SLIDES = [
  '/hero/hero-rudraksha.jpg',
  '/hero/hero-puja.jpg',
  '/hero/hero-yantra.jpg',
  '/hero/hero-astrology.jpg',
  '/hero/hero-ghat.png',
];

export default function Hero({ banner, bgImage }) {
  const title = banner?.title;
  const subtitle = banner?.subtitle || 'Authentic Rudraksha · Certified Gemstones · Sacred Yantra · Jyotish Consultation';
  const btnText = banner?.button_text || 'Explore Collection →';
  const btnLink = banner?.link_url || '#shop';
  const bg = bgImage || banner?.image_url;

  const slides = useMemo(() => {
    const list = [...DEFAULT_SLIDES];
    if (bg && !list.includes(bg)) {
      list.unshift(bg);
    }
    return list;
  }, [bg]);

  const [currentSlide, setCurrentSlide] = useState(0);

  // Automatically cycle through background images every 2 seconds
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <section 
      className="hero"
      style={{
        position: 'relative',
        backgroundColor: '#100c08',
        overflow: 'hidden',
      }}
    >
      {/* Background Image Slider with smooth cross-fade */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {slides.map((imgSrc, idx) => {
          const isActive = idx === currentSlide;
          return (
            <div
              key={imgSrc}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${imgSrc})`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: isActive ? 1 : 0,
                transition: 'opacity 1s ease-in-out',
                zIndex: isActive ? 1 : 0,
              }}
            />
          );
        })}
      </div>

      {/* Responsive spiritual gradient overlay for smooth blending with text */}
      <div className="hero-overlay" aria-hidden="true" />

      <div className="hero-halo" style={{ zIndex: 2 }} />

      <div className="hero-inner" style={{ position: 'relative', zIndex: 2 }}>
        <div className="hero-copy">
          <h1>
            {title && title !== 'परंपरेतून मार्गदर्शन • श्रद्धेतून समाधान' ? (
              title
            ) : (
              <>
                परंपरेतून <em>मार्गदर्शन</em><br />
                श्रद्धेतून <em>समाधान</em>
              </>
            )}
          </h1>
          <p className="sub">
            {subtitle}
          </p>

          <div className="hero-actions">
            <a href={btnLink} className="btn btn-gold">{btnText}</a>
            <a href="#jyotish" className="btn btn-ghost">Book Consultation</a>
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div
        style={{
          position: 'absolute',
          bottom: '22px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          zIndex: 3,
          alignItems: 'center',
        }}
        aria-label="Hero background slider indicators"
      >
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentSlide(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              width: i === currentSlide ? '28px' : '8px',
              height: '7px',
              borderRadius: '999px',
              background: i === currentSlide ? 'var(--gold, #e0b04a)' : 'rgba(255, 255, 255, 0.3)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.4s ease',
            }}
          />
        ))}
      </div>
    </section>
  );
}
