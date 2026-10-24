'use client';
import { useState } from 'react';

export default function PromoRibbon({ banner }) {
  const [closed, setClosed] = useState(false);
  if (!banner || closed) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, #d4af37, #f69145, #d4af37)',
      color: '#1a1005',
      padding: '8px 36px 8px 14px',
      textAlign: 'center',
      fontWeight: 600,
      fontSize: '12.5px',
      letterSpacing: '0.02em',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px 12px',
      flexWrap: 'wrap',
      maxWidth: '100%',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 25,
    }}>
      <span>✨ {banner.title}</span>
      {banner.subtitle && <span style={{ opacity: 0.9 }}>· {banner.subtitle}</span>}
      {banner.link_url && (
        <a href={banner.link_url} style={{ color: '#1a1005', textDecoration: 'underline', fontWeight: 700 }}>
          {banner.button_text || 'Shop Now →'}
        </a>
      )}
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Dismiss announcement ribbon"
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#1a1005',
          fontSize: '16px',
          fontWeight: 700,
          padding: '2px 6px',
          lineHeight: 1,
          opacity: 0.75,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.75'; }}
      >
        ✕
      </button>
    </div>
  );
}
