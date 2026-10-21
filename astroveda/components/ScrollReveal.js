'use client';
import { useEffect } from 'react';
import { useStore } from '@/context/StoreContext';

export default function ScrollReveal() {
  const { closeAll, closeProductModal } = useStore();

  useEffect(() => {
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
