'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'astroveda_dpdp_consent_v1';

export default function CookieConsentModal() {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('privacy'); // 'privacy' | 'return' | 'cookies'
  const [preferences, setPreferences] = useState({
    necessary: true,
    functional: true,
    analytics: true,
    marketing: true,
  });

  useEffect(() => {
    // Check if user has already made a consent choice
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        // Show banner after brief delay
        const t = setTimeout(() => {
          setBannerVisible(true);
        }, 1500);
        return () => clearTimeout(t);
      } else {
        const parsed = JSON.parse(saved);
        if (parsed?.preferences) {
          setPreferences(parsed.preferences);
        }
      }
    } catch (e) {
      console.warn('Cookie consent check error:', e);
    }
  }, []);

  // Expose global window event to open specific policy modal from footer or any link
  useEffect(() => {
    const handleOpenEvent = (e) => {
      const tab = e?.detail?.tab || 'privacy';
      setActiveTab(tab);
      setModalOpen(true);
    };

    window.addEventListener('open-dpdp-policy', handleOpenEvent);
    window.openDpdpPolicy = (tab = 'privacy') => {
      setActiveTab(tab);
      setModalOpen(true);
    };

    return () => {
      window.removeEventListener('open-dpdp-policy', handleOpenEvent);
      delete window.openDpdpPolicy;
    };
  }, []);

  const saveConsent = (prefs) => {
    try {
      const consentRecord = {
        consentDate: new Date().toISOString(),
        version: '1.0-dpdp-act-2023',
        preferences: prefs,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consentRecord));
    } catch (e) {
      console.warn('Failed saving consent:', e);
    }
    setPreferences(prefs);
    setBannerVisible(false);
    setModalOpen(false);
  };

  const handleAcceptAll = () => {
    saveConsent({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    });
  };

  const handleNecessaryOnly = () => {
    saveConsent({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
  };

  const openPolicyTab = (tab) => {
    setActiveTab(tab);
    setModalOpen(true);
  };

  return (
    <>
      {/* ================= FLOATING COOKIE & DPDP CONSENT BANNER ================= */}
      {bannerVisible && (
        <aside
          className="cookie-banner-wrap"
          aria-label="Privacy and Cookie Consent"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9995,
            maxWidth: '520px',
            width: 'calc(100vw - 36px)',
            background: 'linear-gradient(145deg, rgba(24, 11, 26, 0.96) 0%, rgba(14, 6, 16, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(224, 176, 74, 0.45)',
            borderRadius: '16px',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65), 0 0 24px rgba(224, 176, 74, 0.2)',
            padding: '20px',
            color: '#f7dc9a',
            fontFamily: "'Outfit', sans-serif",
            animation: 'bannerSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Subtle gold decorative accent */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #e0b04a, #f7dc9a, #e0b04a, transparent)',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(224, 176, 74, 0.15)',
                border: '1px solid rgba(224, 176, 74, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
              }}
            >
              🍪
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f7dc9a' }}>
                  Privacy &amp; Cookie Consent
                </h4>
                <span
                  style={{
                    fontSize: '10.5px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#4ade80',
                    fontWeight: 600,
                  }}
                >
                  DPDP Act (India) Compliant
                </span>
              </div>
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: '12.5px',
                  lineHeight: '1.5',
                  color: 'rgba(255, 255, 255, 0.85)',
                }}
              >
                Swami Guruji uses necessary cookies and protects your personal data (including birth details for sacred Kundali consultations and shipping address) under India's <strong>Digital Personal Data Protection Act, 2023</strong>.
              </p>
            </div>
          </div>

          {/* Quick Policy Hyperlinks */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              fontSize: '11.5px',
              padding: '8px 0',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '14px',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => openPolicyTab('privacy')}
              style={{
                background: 'none',
                border: 'none',
                color: '#e0b04a',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontWeight: 600,
              }}
            >
              📄 Privacy Policy
            </button>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
            <button
              type="button"
              onClick={() => openPolicyTab('return')}
              style={{
                background: 'none',
                border: 'none',
                color: '#e0b04a',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontWeight: 600,
              }}
            >
              🔄 Product Return &amp; Refund Policy
            </button>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
            <button
              type="button"
              onClick={() => openPolicyTab('cookies')}
              style={{
                background: 'none',
                border: 'none',
                color: '#e0b04a',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontWeight: 600,
              }}
            >
              ⚙️ Manage Cookies
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleAcceptAll}
              style={{
                flex: '1 1 120px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #e0b04a, #d49339)',
                color: '#1a0b10',
                border: 'none',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Accept All
            </button>

            <button
              type="button"
              onClick={handleNecessaryOnly}
              style={{
                flex: '1 1 120px',
                padding: '9px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(224, 176, 74, 0.3)',
                color: '#f7dc9a',
                fontWeight: 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Essential Only
            </button>

            <button
              type="button"
              onClick={() => openPolicyTab('cookies')}
              style={{
                flex: '1 1 100px',
                padding: '9px 12px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: 500,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Preferences
            </button>
          </div>
        </aside>
      )}

      {/* ================= COMPREHENSIVE DPDP & RETURN POLICY MODAL ================= */}
      {modalOpen && (
        <div
          className="policy-modal-overlay"
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 4, 12, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="policy-modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(155deg, #1d0c22 0%, #120616 100%)',
              border: '1px solid rgba(224, 176, 74, 0.45)',
              borderRadius: '20px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 32px rgba(224, 176, 74, 0.25)',
              overflow: 'hidden',
              color: '#f7dc9a',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            {/* Modal Header with Tabs */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid rgba(224, 176, 74, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                background: 'rgba(0, 0, 0, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>⚖️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f7dc9a' }}>
                    Swami Guruji Compliance &amp; Policies
                  </h3>
                  <span style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.65)' }}>
                    Digital Personal Data Protection (DPDP) Act, 2023 · India
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                padding: '8px 20px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                gap: '8px',
                overflowX: 'auto',
                background: 'rgba(0, 0, 0, 0.15)',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('privacy')}
                style={{
                  padding: '10px 16px',
                  background: activeTab === 'privacy' ? 'rgba(224, 176, 74, 0.18)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'privacy' ? '2px solid #e0b04a' : '2px solid transparent',
                  color: activeTab === 'privacy' ? '#f7dc9a' : 'rgba(255, 255, 255, 0.7)',
                  fontWeight: activeTab === 'privacy' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🛡️ DPDP Privacy Policy
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('return')}
                style={{
                  padding: '10px 16px',
                  background: activeTab === 'return' ? 'rgba(224, 176, 74, 0.18)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'return' ? '2px solid #e0b04a' : '2px solid transparent',
                  color: activeTab === 'return' ? '#f7dc9a' : 'rgba(255, 255, 255, 0.7)',
                  fontWeight: activeTab === 'return' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🔄 Sacred Return &amp; Refund Policy
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cookies')}
                style={{
                  padding: '10px 16px',
                  background: activeTab === 'cookies' ? 'rgba(224, 176, 74, 0.18)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'cookies' ? '2px solid #e0b04a' : '2px solid transparent',
                  color: activeTab === 'cookies' ? '#f7dc9a' : 'rgba(255, 255, 255, 0.7)',
                  fontWeight: activeTab === 'cookies' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ⚙️ Cookie Preferences
              </button>
            </div>

            {/* Modal Body Content (Scrollable) */}
            <div
              style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1,
                fontSize: '13.5px',
                lineHeight: '1.65',
                color: 'rgba(255, 255, 255, 0.9)',
              }}
            >
              {/* TAB 1: DPDP ACT PRIVACY POLICY */}
              {activeTab === 'privacy' && (
                <div className="policy-tab-content">
                  <h4 style={{ color: '#e0b04a', fontSize: '17px', marginTop: 0 }}>
                    1. Notice Under Digital Personal Data Protection (DPDP) Act, 2023
                  </h4>
                  <p>
                    Swami Guruji (&ldquo;Data Fiduciary&rdquo;), under the spiritual guidance of Nagesh Swami Guruji (Nashik, Maharashtra, India), values your digital privacy and the sacred trust you place in us. In compliance with the <strong>Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023, India)</strong>, this policy explains how your personal data is collected, processed, and safeguarded.
                  </p>

                  <h5 style={{ color: '#f7dc9a', margin: '18px 0 6px' }}>2. Sacred Data We Collect</h5>
                  <ul style={{ paddingLeft: '20px', margin: '4px 0 12px' }}>
                    <li>
                      <strong>Astrological &amp; Consultation Data:</strong> Date of birth, exact time of birth, place of birth, gender, Gotra, Nakshatra, and personal query details provided during Kundali or Jyotish booking.
                    </li>
                    <li>
                      <strong>Order &amp; Delivery Information:</strong> Full name, shipping postal address, pin code, email address, and WhatsApp mobile number for tracking updates.
                    </li>
                    <li>
                      <strong>Payment Information:</strong> Processed securely via RBI-licensed and PCI-DSS compliant Indian payment gateways (UPI, NetBanking, Credit/Debit Cards). We do <em>never</em> store complete card numbers or CVV.
                    </li>
                  </ul>

                  <h5 style={{ color: '#f7dc9a', margin: '18px 0 6px' }}>3. Lawful Purpose of Data Processing</h5>
                  <p>Your personal data is collected solely for specified, lawful purposes:</p>
                  <ul style={{ paddingLeft: '20px', margin: '4px 0 12px' }}>
                    <li>To generate authentic Vedic horoscope charts (Kundali) and provide tailored Jyotish guidance.</li>
                    <li>To perform personalized *Pran-Pratishtha* (sacred energization) of Rudraksha, Yantras, and Gemstones in the devotee&rsquo;s Gotra and name.</li>
                    <li>To dispatch certified spiritual products and send dispatch/tracking notifications via WhatsApp/SMS.</li>
                  </ul>

                  <h5 style={{ color: '#f7dc9a', margin: '18px 0 6px' }}>4. Absolute Confidentiality of Horoscopes</h5>
                  <p>
                    All astrological consultation notes, birth charts, and private inquiries remain strictly confidential between Guruji and the devotee. We do <strong>never sell, lease, or monetize</strong> your personal or astrological data to third-party advertisers.
                  </p>

                  <h5 style={{ color: '#f7dc9a', margin: '18px 0 6px' }}>5. Devotee Rights Under DPDP Act</h5>
                  <p>As a Data Principal in India, you hold the following statutory rights:</p>
                  <ul style={{ paddingLeft: '20px', margin: '4px 0 12px' }}>
                    <li><strong>Right to Access:</strong> Summary of personal data being processed.</li>
                    <li><strong>Right to Correction &amp; Erasure:</strong> Rectify inaccurate birth data or request deletion of account details upon service completion.</li>
                    <li><strong>Right to Grievance Redressal:</strong> Dedicated redressal through our Grievance Officer.</li>
                    <li><strong>Right to Withdraw Consent:</strong> You may withdraw consent at any time without impacting prior lawful processing.</li>
                  </ul>

                  <div
                    style={{
                      background: 'rgba(224, 176, 74, 0.1)',
                      border: '1px solid rgba(224, 176, 74, 0.3)',
                      borderRadius: '10px',
                      padding: '14px',
                      marginTop: '20px',
                    }}
                  >
                    <strong style={{ color: '#f7dc9a', display: 'block', marginBottom: '4px' }}>
                      Data Protection &amp; Grievance Redressal Officer (India)
                    </strong>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)' }}>
                      Swami Guruji Spiritual Centre · Panchavati, Nashik, Maharashtra - 422003, India<br />
                      Direct WhatsApp: <strong>+91 96231 17545</strong> · Email: <strong>nagesh@gmail.com</strong><br />
                      Response SLA: Within 48 business hours as mandated by Indian law.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SACRED PRODUCT RETURN & REFUND POLICY */}
              {activeTab === 'return' && (
                <div className="policy-tab-content">
                  <h4 style={{ color: '#e0b04a', fontSize: '17px', marginTop: 0 }}>
                    Sacred Product Return &amp; Refund Policy
                  </h4>
                  <p>
                    At Swami Guruji Spiritual Seva, every Rudraksha, Gemstone, Yantra, and Bracelet is handled with the utmost sanctity, accompanied by lab certification and authentic Vedic pran-pratishtha. We stand firmly behind the sanctity and physical perfection of our sacred offerings.
                  </p>

                  <h5 style={{ color: '#f7dc9a', margin: '18px 0 6px' }}>1. 7-Day Hassle-Free Replacement Guarantee</h5>
                  <p>
                    If your product arrives damaged in transit, defective, physically mismatched, or broken, you are entitled to a <strong>100% free immediate replacement or full refund</strong> within <strong>7 days</strong> of delivery.
                  </p>

                  <h5 style={{ color: '#f7dc9a', margin: '18px 0 6px' }}>2. Consecrated &amp; Energized Items Protocol</h5>
                  <p>
                    Due to the sacred nature of items that have undergone personalized *Pran-Pratishtha* rituals performed specifically in your Gotra and name (such as custom energized Nepal Rudraksha or energized Yantras):
                  </p>
                  <ul style={{ paddingLeft: '20px', margin: '4px 0 12px' }}>
                    <li>
                      <strong>Transit Damage / Defect:</strong> Replaced unconditionally at zero cost. Devotees are requested to share an unboxing photo or video via WhatsApp (+91 96231 17545).
                    </li>
                    <li>
                      <strong>Authenticity Guarantee:</strong> Every gemstone and Nepal Rudraksha includes a recognized laboratory certificate. If authenticity is ever questioned with a verifiable lab test, we offer an immediate 100% money-back refund.
                    </li>
                    <li>
                      <strong>Custom Consecration Sanctity:</strong> Once an item is consecrated with Vedic mantras in a devotee&rsquo;s specific Gotra, it cannot be recycled to another devotee. Please confirm your size/preference before dispatch.
                    </li>
                  </ul>

                  <h5 style={{ color: '#f7dc9a', margin: '18px 0 6px' }}>3. How to Initiate a Return or Replacement</h5>
                  <ol style={{ paddingLeft: '20px', margin: '4px 0 12px' }}>
                    <li>Click <strong>&ldquo;Track Your Order&rdquo;</strong> in the website header or footer and select &ldquo;Request Return/Exchange&rdquo;.</li>
                    <li>Or send a quick message to our team on WhatsApp at <strong>+91 96231 17545</strong> with your Order ID and photo/video.</li>
                    <li>Our reverse-pickup courier partner will collect the item from your doorstep across all serviceable Indian pincodes.</li>
                  </ol>

                  <h5 style={{ color: '#f7dc9a', margin: '18px 0 6px' }}>4. Refund Timeline</h5>
                  <p>
                    Upon return verification, refunds are issued within <strong>3 to 5 business days</strong> directly to your original payment method (UPI / Bank Account / Card) with instant SMS and WhatsApp confirmation.
                  </p>
                </div>
              )}

              {/* TAB 3: COOKIE PREFERENCES & SETTINGS */}
              {activeTab === 'cookies' && (
                <div className="policy-tab-content">
                  <h4 style={{ color: '#e0b04a', fontSize: '17px', marginTop: 0 }}>
                    Manage Granular Cookie Preferences (DPDP Act, 2023)
                  </h4>
                  <p>
                    In accordance with India&rsquo;s DPDP Act, you have granular control over which categories of digital cookies and identifiers Swami Guruji can store on your browser.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                    {/* Item 1: Strictly Necessary */}
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ color: '#f7dc9a', fontSize: '14px' }}>Strictly Necessary Cookies</strong>
                          <span
                            style={{
                              fontSize: '10.5px',
                              background: 'rgba(34, 197, 94, 0.2)',
                              color: '#4ade80',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            Always Active
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          Required for secure checkout, shopping cart persistence, coupon calculation, CSRF protection, and order tracking verification.
                        </p>
                      </div>
                      <input type="checkbox" checked disabled style={{ cursor: 'not-allowed', width: '18px', height: '18px' }} />
                    </div>

                    {/* Item 2: Functional / Spiritual Preferences */}
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: '#f7dc9a', fontSize: '14px' }}>Spiritual Personalization &amp; Wishlist</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          Preserves your sacred Wishlist, language preferences (Marathi/English/Hindi), and recent consultation service selections.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) => setPreferences((p) => ({ ...p, functional: e.target.checked }))}
                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#e0b04a' }}
                      />
                    </div>

                    {/* Item 3: Performance & Analytics */}
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: '#f7dc9a', fontSize: '14px' }}>Analytics &amp; Site Performance</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          Anonymous aggregated metrics that help us optimize server response times, high-traffic Puja booking capacity, and site reliability.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences((p) => ({ ...p, analytics: e.target.checked }))}
                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#e0b04a' }}
                      />
                    </div>

                    {/* Item 4: WhatsApp & Communications */}
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: '#f7dc9a', fontSize: '14px' }}>WhatsApp &amp; Communication Updates</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          Enables automated shipment tracking alerts, Guruji consultation reminder links, and Panchang tithi notifications via WhatsApp.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={(e) => setPreferences((p) => ({ ...p, marketing: e.target.checked }))}
                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#e0b04a' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid rgba(224, 176, 74, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                background: 'rgba(0, 0, 0, 0.3)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.6)' }}>
                You can change these settings anytime via the Privacy &amp; Return links in the footer.
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #e0b04a, #d49339)',
                    color: '#1a0b10',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Save My Preferences
                </button>

                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    fontWeight: 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes bannerSlideUp {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (max-width: 640px) {
          .cookie-banner-wrap {
            right: 12px !important;
            left: 12px !important;
            bottom: 12px !important;
            max-width: none !important;
            width: auto !important;
            padding: 16px !important;
          }
          .policy-modal-container {
            max-height: 94vh !important;
            border-radius: 14px !important;
          }
        }
      `}</style>
    </>
  );
}
