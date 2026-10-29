'use client';

/**
 * Official Social Profiles Configuration
 * Configure via NEXT_PUBLIC_INSTAGRAM_URL, NEXT_PUBLIC_LINKEDIN_URL, NEXT_PUBLIC_FACEBOOK_URL
 * or update the fallback constants below with the website owner's verified profile URLs.
 */
export const OFFICIAL_SOCIAL_PROFILES = {
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/swamiguruji', // [ACTION REQUIRED: Verify / update with real official Instagram profile URL]
  linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL || 'https://www.linkedin.com/company/swamiguruji', // [ACTION REQUIRED: Verify / update with real official LinkedIn profile URL]
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || 'https://www.facebook.com/swamiguruji', // [ACTION REQUIRED: Verify / update with real official Facebook profile URL]
};

export default function WhatsAppFloat() {
  return (
    <>
      {/* Compact Floating Social Media Panel (Instagram, LinkedIn, Facebook in order) */}
      <aside
        className="social-floating-panel"
        aria-label="Official Social Media Links"
      >
        {/* 1. Instagram */}
        <a
          href={OFFICIAL_SOCIAL_PROFILES.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="social-floating-btn social-btn-instagram"
          aria-label="Visit our official Instagram profile (opens in a new tab)"
          title="Instagram"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
        </a>

        {/* 2. LinkedIn */}
        <a
          href={OFFICIAL_SOCIAL_PROFILES.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="social-floating-btn social-btn-linkedin"
          aria-label="Visit our official LinkedIn profile (opens in a new tab)"
          title="LinkedIn"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
          </svg>
        </a>

        {/* 3. Facebook */}
        <a
          href={OFFICIAL_SOCIAL_PROFILES.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="social-floating-btn social-btn-facebook"
          aria-label="Visit our official Facebook profile (opens in a new tab)"
          title="Facebook"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </a>
      </aside>

      {/* Existing Floating WhatsApp Button */}
      <a
        href="https://wa.me/919623117545"
        target="_blank"
        rel="noopener noreferrer"
        className="wa-float"
        aria-label="WhatsApp"
        title="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.2-.7.2-.8 1-1 1.2-.4.3-.7.1a8 8 0 01-2.4-1.5 9 9 0 01-1.6-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-1-2.4c-.2-.6-.5-.5-.7-.5H7a1.4 1.4 0 00-1 .5 4.3 4.3 0 00-1.3 3.2 7.4 7.4 0 001.6 4 17 17 0 006.6 5.8c.9.4 1.6.6 2.2.8a5.3 5.3 0 002.4.1 4 4 0 002.6-1.8 3.2 3.2 0 00.2-1.8c-.1-.2-.3-.3-.6-.4zM12 22a10 10 0 01-5.1-1.4L2 22l1.4-4.8A10 10 0 1112 22z"/>
        </svg>
      </a>
    </>
  );
}
