'use client';

import React, { useState } from 'react';

export default function OfflinePaymentBox({
  instructions = '',
  qrCodeUrl = '/phonepe-qr.jpg',
  referenceNumber = '',
  amount = null,
  customerName = '',
  whatsappUrl = '',
  whatsappButtonText = 'Share Payment Screenshot on WhatsApp',
  title = 'Offline Payment Instructions / पेमेंट पद्धत',
}) {
  // Active tab: 'qr' (QR Code) or 'bank' (Bank Details) or 'both' (Side-by-side)
  const [activeTab, setActiveTab] = useState('qr');
  const [copiedKey, setCopiedKey] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);

  const bankDetails = {
    bankName: 'Bank of Maharashtra',
    accountName: 'Nagesh Vishwanath Shelgaonkar',
    accountNumber: '60044303280',
    ifscCode: 'MAHB0001169',
    upiId: 'astroveda@sbi',
    whatsapp: '+91 96231 17545',
  };

  const handleCopy = (text, key) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const allBankText = `Bank: ${bankDetails.bankName}\nAccount Name: ${bankDetails.accountName}\nAccount Number: ${bankDetails.accountNumber}\nIFSC Code: ${bankDetails.ifscCode}\nUPI ID: ${bankDetails.upiId}\nWhatsApp: ${bankDetails.whatsapp}${referenceNumber ? `\nOrder / Reference: ${referenceNumber}` : ''}${amount ? `\nAmount: ₹${amount}` : ''}`;

  const defaultWaUrl = `https://wa.me/919623117545?text=${encodeURIComponent(
    `Namaste! I have made an offline payment${referenceNumber ? ` for ${referenceNumber}` : ''}${amount ? ` (Amount: ₹${amount})` : ''}. Here is my payment transaction screenshot:`
  )}`;
  const effectiveWaUrl = whatsappUrl || defaultWaUrl;

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(234, 88, 12, 0.09) 0%, rgba(20, 16, 28, 0.65) 100%)',
        border: '1.5px solid rgba(234, 88, 12, 0.35)',
        borderRadius: '16px',
        padding: '20px 22px',
        maxWidth: '580px',
        margin: '0 auto 24px',
        textAlign: 'left',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>⏳</span>
          <span style={{ color: '#fed7aa', fontWeight: '800', fontSize: '14.5px', letterSpacing: '0.3px' }}>
            {title}
          </span>
        </div>
        {amount && (
          <span
            style={{
              background: 'rgba(234, 88, 12, 0.2)',
              border: '1px solid rgba(234, 88, 12, 0.5)',
              color: '#fcd34d',
              padding: '3px 10px',
              borderRadius: '99px',
              fontSize: '12.5px',
              fontWeight: '700',
            }}
          >
            देय रक्कम: ₹{amount}
          </span>
        )}
      </div>

      <p style={{ fontSize: '12.5px', color: 'var(--cream, #fef3c7)', margin: '0 0 14px', lineHeight: '1.5' }}>
        {customerName ? `आदरणीय ${customerName}, ` : ''}तुमचा आदेश सुरक्षितपणे नोंदवला गेला आहे. कृपया PhonePe QR स्कॅन करून किंवा थेट बँक खात्यात रक्कम ट्रान्सफर करा:
      </p>

      {/* Tab Navigation & View Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '16px',
          gap: '4px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '4px', flex: '1 1 auto' }}>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'qr' ? 'linear-gradient(135deg, #5f259f, #7c3aed)' : 'transparent',
              color: activeTab === 'qr' ? '#ffffff' : '#cbd5e1',
              fontWeight: activeTab === 'qr' ? '800' : '600',
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'qr' ? '0 2px 8px rgba(95, 37, 159, 0.4)' : 'none',
            }}
          >
            <span>📱</span>
            <span>PhonePe QR कोड</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'bank' ? 'linear-gradient(135deg, #ea580c, #c2410c)' : 'transparent',
              color: activeTab === 'bank' ? '#ffffff' : '#cbd5e1',
              fontWeight: activeTab === 'bank' ? '800' : '600',
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'bank' ? '0 2px 8px rgba(234, 88, 12, 0.4)' : 'none',
            }}
          >
            <span>🏦</span>
            <span>बँक तपशील</span>
          </button>
        </div>

        {/* Side-by-side toggle button for desktop/tablets */}
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'both' ? 'qr' : 'both')}
          title="दोन्ही बाजूला पहा (Side by side)"
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: activeTab === 'both' ? 'rgba(255,255,255,0.15)' : 'transparent',
            color: activeTab === 'both' ? '#fcd34d' : '#94a3b8',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {activeTab === 'both' ? '✕ Tabs View' : '⊞ Side-by-Side'}
        </button>
      </div>

      {/* TAB CONTENT CONTAINER */}
      <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'both' ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr', gap: '14px', marginBottom: '16px' }}>
        {/* QR CODE VIEW (When activeTab === 'qr' or 'both') */}
        {(activeTab === 'qr' || activeTab === 'both') && (
          <div
            style={{
              background: 'rgba(15, 12, 22, 0.85)',
              border: '1px solid rgba(124, 58, 237, 0.35)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* PhonePe Header */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#5f259f',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.4px',
                marginBottom: '10px',
              }}
            >
              <span>पे</span>
              <span>PhonePe ACCEPTED HERE</span>
            </div>

            <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#fed7aa', fontWeight: '600' }}>
              Scan &amp; Pay using PhonePe, Google Pay, Paytm or any UPI App
            </p>

            {/* QR Image with click to zoom */}
            <div
              onClick={() => setIsZoomed(true)}
              style={{
                cursor: 'pointer',
                position: 'relative',
                display: 'inline-block',
                background: '#ffffff',
                padding: '8px',
                borderRadius: '12px',
                boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                transition: 'transform 0.2s ease',
              }}
              title="Click to enlarge QR code / स्कॅन करण्यासाठी झूम करा"
            >
              <img
                src={qrCodeUrl}
                alt="PhonePe QR Code - Mr. Nagesh Vishwanath Shelgaonkar"
                style={{
                  width: '180px',
                  height: 'auto',
                  maxHeight: '220px',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  display: 'block',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px',
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                }}
              >
                🔍 झूम
              </span>
            </div>

            <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: '700', color: '#fef3c7' }}>
              Mr. NAGESH VISHWANATH SHELGAONKAR
            </div>

            <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
              Direct UPI ID: <strong style={{ color: '#fcd34d' }}>{bankDetails.upiId}</strong>
            </div>

            {/* Quick Actions for QR */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => handleCopy(bankDetails.upiId, 'upi')}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fcd34d',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {copiedKey === 'upi' ? '✓ UPI ID Copied!' : '📋 Copy UPI ID'}
              </button>

              <a
                href={qrCodeUrl}
                download="phonepe-qr-astroveda.jpg"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#cbd5e1',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ⬇️ Download QR
              </a>
            </div>
          </div>
        )}

        {/* BANK DETAILS VIEW (When activeTab === 'bank' or 'both') */}
        {(activeTab === 'bank' || activeTab === 'both') && (
          <div
            style={{
              background: 'rgba(10, 8, 16, 0.85)',
              border: '1px solid rgba(234, 88, 12, 0.35)',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#fed7aa' }}>
                🏦 बँक खाते तपशील (NEFT / IMPS / RTGS)
              </span>
              <button
                type="button"
                onClick={() => handleCopy(allBankText, 'all_bank')}
                style={{
                  background: 'rgba(234, 88, 12, 0.18)',
                  border: '1px solid rgba(234, 88, 12, 0.45)',
                  color: '#fed7aa',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                {copiedKey === 'all_bank' ? '✓ सर्व कॉपी झाले!' : '📋 सर्व कॉपी करा'}
              </button>
            </div>

            {/* Structured Key-Value List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              {/* Bank Name */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>बँक (Bank):</span>
                <strong style={{ color: '#ffffff' }}>{bankDetails.bankName}</strong>
              </div>

              {/* Account Holder */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>नाव (Account Name):</span>
                <strong style={{ color: '#fef3c7' }}>{bankDetails.accountName}</strong>
              </div>

              {/* Account Number */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>खाते क्रमांक (A/C No):</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: '#fcd34d', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{bankDetails.accountNumber}</strong>
                  <button
                    type="button"
                    onClick={() => handleCopy(bankDetails.accountNumber, 'acc')}
                    title="Copy Account Number"
                    style={{ background: 'none', border: 'none', color: '#fed7aa', cursor: 'pointer', fontSize: '11px', padding: '2px 4px' }}
                  >
                    {copiedKey === 'acc' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              {/* IFSC Code */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>IFSC Code:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: '#fcd34d', fontFamily: 'monospace' }}>{bankDetails.ifscCode}</strong>
                  <button
                    type="button"
                    onClick={() => handleCopy(bankDetails.ifscCode, 'ifsc')}
                    title="Copy IFSC Code"
                    style={{ background: 'none', border: 'none', color: '#fed7aa', cursor: 'pointer', fontSize: '11px', padding: '2px 4px' }}
                  >
                    {copiedKey === 'ifsc' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              {/* UPI ID */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Direct UPI ID:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: '#a7f3d0' }}>{bankDetails.upiId}</strong>
                  <button
                    type="button"
                    onClick={() => handleCopy(bankDetails.upiId, 'upi2')}
                    title="Copy UPI ID"
                    style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', fontSize: '11px', padding: '2px 4px' }}
                  >
                    {copiedKey === 'upi2' ? '✓' : '📋'}
                  </button>
                </div>
              </div>
            </div>

            {/* Custom backend text snippet if different */}
            {instructions && (
              <details style={{ marginTop: '10px', fontSize: '11px', color: '#cbd5e1' }}>
                <summary style={{ cursor: 'pointer', color: '#fed7aa', fontWeight: '600' }}>
                  संपूर्ण सूचना मजकूर पहा (Full Instructions)
                </summary>
                <div style={{ marginTop: '6px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '8px', fontFamily: 'monospace', whiteSpace: 'pre-line', lineHeight: '1.4', color: '#fcd34d' }}>
                  {instructions}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Devotee WhatsApp Confirmation Link */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
        <p style={{ fontSize: '11.5px', color: '#cbd5e1', margin: '0 0 10px', lineHeight: '1.4' }}>
          📌 <strong>पुढील पायरी:</strong> पेमेंट पूर्ण झाल्यावर, पेमेंटचा स्क्रीनशॉट आणि तुमचा {referenceNumber ? `Order ID (${referenceNumber})` : 'Order ID'} खालील बटणावर क्लिक करून WhatsApp वर पाठवा.
        </p>

        <a
          href={effectiveWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '11px 18px',
            background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '13px',
            borderRadius: '10px',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <span style={{ fontSize: '16px' }}>💬</span>
          <span>{whatsappButtonText}</span>
        </a>
      </div>

      {/* FULLSCREEN QR MODAL OVERLAY */}
      {isZoomed && (
        <div
          onClick={() => setIsZoomed(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '20px',
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              padding: '16px',
              borderRadius: '16px',
              maxWidth: '360px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: '800', color: '#5f259f', fontSize: '14px' }}>PhonePe ACCEPTED HERE</span>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>
            <img
              src={qrCodeUrl}
              alt="PhonePe QR Code Enlarge"
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }}
            />
            <div style={{ marginTop: '10px', fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>
              Mr. NAGESH VISHWANATH SHELGAONKAR
            </div>
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
              Scan from any UPI App: PhonePe, GPay, Paytm, BHIM
            </div>
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: '#5f259f',
                color: '#fff',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              बंद करा (Close)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
