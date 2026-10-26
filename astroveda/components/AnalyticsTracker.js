'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  getVisitorId,
  getSessionId,
  recordEvent,
  flushEventQueue,
  sendHeartbeat,
} from '@/lib/analytics';

const SECTION_IDS = [
  'hero',
  'shop',
  'puja',
  'jyotish',
  'rudraksha',
  'ratna',
  'yantra',
  'bracelets',
  'puja-samagri',
  'video-tour',
  'testimonials',
  'blog',
  'why',
  'about',
];

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const currentSectionRef = useRef(null);
  const sectionStartTimeRef = useRef(Date.now());
  const isIdleRef = useRef(false);
  const idleTimerRef = useRef(null);
  const engagedSecondsAccumulator = useRef(0);

  // Initialize and track pageviews on route change
  useEffect(() => {
    // Ensure visitor & session IDs exist
    getVisitorId();
    getSessionId();

    const title = document.title || 'AstroVeda';
    recordEvent({
      type: 'pageview',
      path: pathname || '/',
      title,
    });
    flushEventQueue();
  }, [pathname]);

  // Track user activity vs idle state
  useEffect(() => {
    const resetIdleTimer = () => {
      isIdleRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      // Mark as idle after 45s of no user input
      idleTimerRef.current = setTimeout(() => {
        isIdleRef.current = true;
      }, 45000);
    };

    resetIdleTimer();

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    const opts = { passive: true };

    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer, opts));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Periodic Foreground Heartbeat & Engagement Accumulator
  useEffect(() => {
    let intervalTimer = setInterval(() => {
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      if (isVisible && !isIdleRef.current) {
        engagedSecondsAccumulator.current += 1;
      }
    }, 1000);

    // Send heartbeat every 15 seconds
    let heartbeatTimer = setInterval(() => {
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      if (isVisible && !isIdleRef.current && engagedSecondsAccumulator.current > 0) {
        const delta = engagedSecondsAccumulator.current;
        engagedSecondsAccumulator.current = 0;
        sendHeartbeat(delta, pathname || '/', currentSectionRef.current);
      }
    }, 15000);

    return () => {
      clearInterval(intervalTimer);
      clearInterval(heartbeatTimer);
    };
  }, [pathname]);

  // Section Tracking via IntersectionObserver
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const flushSectionDuration = (sectionId, startTime) => {
      if (!sectionId || !startTime) return;
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      if (durationSec >= 3) {
        recordEvent({
          type: 'section_engagement',
          section: sectionId,
          duration: durationSec,
          path: pathname || '/',
        });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
            const newSec = entry.target.id;
            if (newSec && newSec !== currentSectionRef.current) {
              // Flush time spent in previous section
              flushSectionDuration(currentSectionRef.current, sectionStartTimeRef.current);
              currentSectionRef.current = newSec;
              sectionStartTimeRef.current = Date.now();

              recordEvent({
                type: 'section_view',
                section: newSec,
                path: pathname || '/',
              });
            }
          }
        });
      },
      {
        threshold: [0.25, 0.5],
      }
    );

    // Observe each known storefront section
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      flushSectionDuration(currentSectionRef.current, sectionStartTimeRef.current);
      observer.disconnect();
    };
  }, [pathname]);

  // Flush on unload & visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (engagedSecondsAccumulator.current > 0) {
          sendHeartbeat(engagedSecondsAccumulator.current, pathname || '/', currentSectionRef.current);
          engagedSecondsAccumulator.current = 0;
        }
        flushEventQueue(true);
      }
    };

    const handleBeforeUnload = () => {
      if (engagedSecondsAccumulator.current > 0) {
        sendHeartbeat(engagedSecondsAccumulator.current, pathname || '/', currentSectionRef.current);
        engagedSecondsAccumulator.current = 0;
      }
      flushEventQueue(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname]);

  return null; // Headless component
}
