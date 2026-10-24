'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/context/StoreContext';

const BUYERS = [
  { name: 'Rahul Sharma', city: 'Pune, MH' },
  { name: 'Priya Kulkarni', city: 'Mumbai, MH' },
  { name: 'Amit Deshmukh', city: 'Nashik, MH' },
  { name: 'Snehal Patil', city: 'Kolhapur, MH' },
  { name: 'Anand Joshi', city: 'Thane, MH' },
  { name: 'Kavita Shinde', city: 'Nagpur, MH' },
  { name: 'Vikram Gaikwad', city: 'Chhatrapati Sambhajinagar' },
  { name: 'Mahesh Rane', city: 'Satara, MH' },
  { name: 'Pooja Kadam', city: 'Solapur, MH' },
  { name: 'Suresh Iyer', city: 'Bengaluru, KA' },
  { name: 'Rajesh Tiwari', city: 'Indore, MP' },
  { name: 'Anjali Sawant', city: 'Dombivli, MH' },
];

const RECENT_PRODUCTS = [
  {
    id: 29,
    title: 'Tiger Eye Courage & Wealth Bracelet',
    price: '₹899',
    img: '/products/tiger_eye_bracelet.png',
    slug: 'tiger-eye-bracelet',
  },
  {
    id: 27,
    title: 'Rose Quartz Love & Harmony Bracelet',
    price: '₹999',
    img: '/products/rose_quartz_bracelet.jpg',
    slug: 'rose-quartz-bracelet',
  },
  {
    id: 3,
    title: '5 Mukhi Rudraksha Mala (108 Beads)',
    price: '₹2,499',
    img: '/Five-Mukhi Rudraksha in Golden Light-1.png',
    slug: 'rudraksha-mala-5-mukhi-rm-005',
  },
  {
    id: 28,
    title: 'Black Tourmaline Protection Bracelet',
    price: '₹849',
    img: '/products/black_tourmaline_bracelet.png',
    slug: 'black-tourmaline-bracelet',
  },
  {
    id: 31,
    title: 'Money Magnet Abundance Bracelet',
    price: '₹1,199',
    img: '/products/money_magnet_bracelet.png',
    slug: 'money-magnet-bracelet',
  },
  {
    id: 30,
    title: 'Sri Yantra in Pure Copper',
    price: '₹3,500',
    img: '/Golden Shri Yantra on an Ivory Altar-2.png',
    slug: 'sri-yantra-in-pure-copper-rm-oo4',
  },
  {
    id: 32,
    title: 'Clear Quartz Amplification Bracelet',
    price: '₹949',
    img: '/products/clear_quartz_bracelet.png',
    slug: 'clear-quartz-bracelet',
  },
  {
    id: 26,
    title: 'Navagraha Mixed-Stone Bracelet',
    price: '₹1,899',
    img: '/products/tiger_eye_bracelet.png',
    slug: 'navagraha-mixed-stone-bracelet-brc-nav',
  },
];

const TIME_AGOS = ['Just now', '1 min ago', '2 mins ago', '3 mins ago', '4 mins ago'];

export default function UrgencyNotification() {
  const { openProductModal, addToCart } = useStore();

  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(418); // 06:58 initial urgency timer
  const [isHovered, setIsHovered] = useState(false);

  const timerRef = useRef(null);
  const cycleTimeoutRef = useRef(null);

  // Live countdown timer ticking down every second
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 540; // reset to 9 minutes if it reaches 0
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, []);

  // Format seconds to mm:ss
  const formatTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Helper to pick next random purchase event
  const getNextEvent = () => {
    const randomBuyer = BUYERS[Math.floor(Math.random() * BUYERS.length)];
    const randomProduct = RECENT_PRODUCTS[Math.floor(Math.random() * RECENT_PRODUCTS.length)];
    const randomTime = TIME_AGOS[Math.floor(Math.random() * TIME_AGOS.length)];
    const stockLeft = Math.floor(Math.random() * 4) + 2; // 2 to 5 left
    return {
      buyer: randomBuyer,
      product: randomProduct,
      timeAgo: randomTime,
      stockLeft,
    };
  };

  // Cycle notifications
  useEffect(() => {
    if (dismissed) return;

    // Initial event setup
    setCurrentEvent(getNextEvent());

    // Initial appearance after 3.2 seconds
    const initialTimer = setTimeout(() => {
      setVisible(true);
    }, 3200);

    return () => clearTimeout(initialTimer);
  }, [dismissed]);

  // Handle visibility cycle (show for 6.5s, hide for 5.5s, repeat with new item)
  useEffect(() => {
    if (dismissed) return;

    if (visible) {
      if (isHovered) return; // Keep visible if user is interacting with it
      cycleTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 6500);
    } else {
      cycleTimeoutRef.current = setTimeout(() => {
        setCurrentEvent(getNextEvent());
        setVisible(true);
      }, 5500);
    }

    return () => clearTimeout(cycleTimeoutRef.current);
  }, [visible, dismissed, isHovered]);

  if (dismissed || !currentEvent) return null;

  const { buyer, product, timeAgo, stockLeft } = currentEvent;

  return (
    <div
      className={`urgency-toast-wrapper ${visible ? 'is-visible' : 'is-hidden'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        left: '20px',
        bottom: '20px',
        zIndex: 995,
        maxWidth: '380px',
        width: 'calc(100vw - 40px)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.96)',
        opacity: visible ? 1 : 0,
      }}
      aria-live="polite"
    >
      <div
        className="urgency-card"
        style={{
          background: 'linear-gradient(135deg, rgba(26, 12, 28, 0.94) 0%, rgba(18, 8, 20, 0.96) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(224, 176, 74, 0.35)',
          borderRadius: '14px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55), 0 0 20px rgba(224, 176, 74, 0.15)',
          padding: '12px 14px',
          color: '#f7dc9a',
          fontFamily: "'Outfit', sans-serif",
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '9px',
        }}
      >
        {/* Subtle decorative gold shimmer bar on top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #e0b04a, #f7dc9a, #e0b04a, transparent)',
          }}
        />

        {/* Header row: Live verified beacon + dismiss */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: 'rgba(247, 220, 154, 0.85)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                boxShadow: '0 0 8px #22c55e',
                display: 'inline-block',
                animation: 'urgencyPulse 2s infinite',
              }}
            />
            <span style={{ fontWeight: 700, color: '#4ade80' }}>Verified Order</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span style={{ opacity: 0.85, textTransform: 'none' }}>{timeAgo}</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setVisible(false);
              setDismissed(true);
            }}
            aria-label="Dismiss notification"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0 4px',
              lineHeight: 1,
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseOut={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
          >
            ✕
          </button>
        </div>

        {/* Content row: Product image + Details */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
          }}
          onClick={() => {
            if (openProductModal) {
              openProductModal(product);
            }
          }}
          title="Click to view product details"
        >
          {/* Product Thumbnail */}
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '10px',
              overflow: 'hidden',
              flexShrink: 0,
              border: '1px solid rgba(224, 176, 74, 0.4)',
              background: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={product.img}
              alt={product.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              onError={(e) => {
                e.currentTarget.src = '/categories/rudraksha.png';
              }}
            />
          </div>

          {/* Customer & Product Information */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '12.5px',
                color: '#fff',
                lineHeight: 1.3,
                marginBottom: '2px',
              }}
            >
              <strong style={{ color: '#f7dc9a', fontWeight: 600 }}>{buyer.name}</strong>{' '}
              <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11.5px' }}>({buyer.city})</span>
            </div>

            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#e0b04a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.3,
              }}
            >
              Purchased {product.title}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '3px',
                fontSize: '11.5px',
              }}
            >
              <span style={{ fontWeight: 700, color: '#fef08a' }}>{product.price}</span>
              <span
                style={{
                  fontSize: '10.5px',
                  color: '#fbbf24',
                  background: 'rgba(224, 176, 74, 0.15)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(224, 176, 74, 0.3)',
                }}
              >
                ⚡ {stockLeft} left in batch
              </span>
            </div>
          </div>
        </div>

        {/* Urgency Countdown Bar */}
        <div
          style={{
            marginTop: '2px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'rgba(255, 255, 255, 0.85)' }}>
            <span>⏳</span>
            <span>Vedic Blessing Offer ends in:</span>
          </div>

          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontWeight: 800,
              fontSize: '12.5px',
              color: '#ff6b6b',
              background: 'rgba(255, 75, 75, 0.12)',
              border: '1px solid rgba(255, 75, 75, 0.3)',
              padding: '2px 7px',
              borderRadius: '5px',
              letterSpacing: '1px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {formatTime(secondsLeft)}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes urgencyPulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
        @media (max-width: 640px) {
          .urgency-toast-wrapper {
            left: 14px !important;
            bottom: 14px !important;
            max-width: calc(100vw - 28px) !important;
          }
        }
      `}</style>
    </div>
  );
}
