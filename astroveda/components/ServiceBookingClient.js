'use client';

import { useState } from 'react';
import Link from 'next/link';
import PujaBookingModal from '@/components/PujaBookingModal';

export default function ServiceBookingClient({ service, isPuja = true }) {
  const [modalOpen, setModalOpen] = useState(false);

  const priceNum = Number(service.price || service.discountedPrice || 2100);
  const waMessage = `Pranam Guruji, I wish to book the *${service.name || service.title}* (Price: ₹${priceNum.toLocaleString('en-IN')}). Please provide guidance on auspicious muhurat and sankalp details.`;
  const waUrl = `https://wa.me/919623117545?text=${encodeURIComponent(waMessage)}`;

  return (
    <>
      <div className="service-action-cta-box">
        <div className="service-price-summary">
          <span className="svc-fee-label">Dakshina &amp; Samagri Fee:</span>
          <span className="svc-fee-val">₹{priceNum.toLocaleString('en-IN')}</span>
          <span className="svc-fee-note">Inclusive of all sacred samagri, purohit dakshina &amp; live sankalp</span>
        </div>

        <div className="service-cta-buttons">
          {isPuja ? (
            <button
              type="button"
              className="btn btn-gold btn-book-svc"
              onClick={() => setModalOpen(true)}
            >
              🪔 Book This Puja Ritual Online
            </button>
          ) : (
            <Link
              href="/#jyotish"
              className="btn btn-gold btn-book-svc"
            >
              📜 Book Kundali Consultation
            </Link>
          )}

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp-consult"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.2-.7.2-.8 1-1 1.2-.4.3-.7.1a8 8 0 01-2.4-1.5 9 9 0 01-1.6-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-1-2.4c-.2-.6-.5-.5-.7-.5H7a1.4 1.4 0 00-1 .5 4.3 4.3 0 00-1.3 3.2 7.4 7.4 0 001.6 4 17 17 0 006.6 5.8c.9.4 1.6.6 2.2.8a5.3 5.3 0 002.4.1 4 4 0 002.6-1.8 3.2 3.2 0 00.2-1.8c-.1-.2-.3-.3-.6-.4zM12 22a10 10 0 01-5.1-1.4L2 22l1.4-4.8A10 10 0 1112 22z" />
            </svg>
            <span>Ask Guruji via WhatsApp</span>
          </a>
        </div>
      </div>

      {isPuja && (
        <PujaBookingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          initialPujaTitle={service.name || service.title}
        />
      )}
    </>
  );
}
