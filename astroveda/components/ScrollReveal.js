'use client';
import { useEffect } from 'react';
import { useStore } from '@/context/StoreContext';

export default function ScrollReveal() {
  const { closeAll, closeProductModal } = useStore();

  useEffect(() => {
    // 1. Force manual scroll restoration so browsers do not auto-jump to previous scroll positions
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }

      // 2. On landing / search entry, always show the Hero section first
      // If a search engine referred with an anchor hash (like #jyotish), clear it so page starts at Hero
      const currentHash = window.location.hash;
      if (currentHash && currentHash !== '#top') {
        try {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          window.location.hash = '';
        }
      }

      // Immediately reset to top to show Hero section
      window.scrollTo(0, 0);

      // Animation frame and brief timeout to ensure browser does not restore scroll after paint
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      });

      const resetTimer = setTimeout(() => {
        if (!window.location.hash && window.scrollY > 0) {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
      }, 60);
    }

    // Escape key closes open modals/drawers
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeAll();
        closeProductModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Scroll reveal observer
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
      );

      const observeElements = () => {
        const elements = document.querySelectorAll('.reveal:not(.in)');
        elements.forEach((el) => {
          io.observe(el);
        });
      };

      observeElements();

      const mo = new MutationObserver(() => {
        observeElements();
      });
      mo.observe(document.body, { childList: true, subtree: true });

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        io.disconnect();
        mo.disconnect();
      };
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeAll, closeProductModal]);

  return null;
}
