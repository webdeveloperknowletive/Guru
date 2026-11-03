'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import ProductCard from '@/components/ProductCard';

export default function ProductCarousel({
  products = [],
  ariaLabel = 'Products carousel',
  emptyMessage = 'No products available in this category.',
  selectedId = null,
}) {
  const trackRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const rafIdRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const [canScroll, setCanScroll] = useState(false);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);

  // Check whether content overflows container width
  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    // Check true overflow: does scrollWidth exceed visible clientWidth?
    // Using a 2px tolerance to avoid subpixel rounding artifacts
    const overflow = track.scrollWidth > track.clientWidth + 2;
    setCanScroll(overflow);

    if (overflow) {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const currentScroll = track.scrollLeft;
      setIsAtStart(currentScroll <= 5);
      setIsAtEnd(currentScroll >= maxScroll - 5 || maxScroll <= 0);
    } else {
      setIsAtStart(true);
      setIsAtEnd(true);
    }
  }, []);

  // Passive scroll handler with RAF throttling
  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      updateScrollState();
    });
  }, [updateScrollState]);

  // Recalculate on mount, resize, content change, and via ResizeObserver
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Initial check
    updateScrollState();

    track.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollState, { passive: true });

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateScrollState();
      });
      ro.observe(track);
      Array.from(track.children).forEach(child => ro.observe(child));
    }

    return () => {
      track.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollState);
      if (ro) ro.disconnect();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      clearTimeout(scrollTimeoutRef.current);
    };
  }, [updateScrollState, handleScroll, products]);

  // Scroll navigation helpers
  const handleScrollNext = () => {
    const track = trackRef.current;
    if (!track) return;

    const currentScroll = track.scrollLeft;
    const viewportWidth = track.clientWidth;
    const maxScroll = Math.max(0, track.scrollWidth - viewportWidth);
    if (currentScroll >= maxScroll - 3) return;

    const items = Array.from(track.querySelectorAll('.product-card-item, .rudraksha-card-item'));
    if (items.length === 0) return;

    // Find first item whose right edge extends beyond the visible window
    let targetItem = items.find(item => {
      const rightEdge = item.offsetLeft + item.offsetWidth;
      return rightEdge > currentScroll + viewportWidth + 5 && item.offsetLeft > currentScroll + 5;
    });

    if (!targetItem) {
      targetItem = items.find(item => item.offsetLeft > currentScroll + 5);
    }

    const targetScroll = targetItem ? Math.min(targetItem.offsetLeft, maxScroll) : maxScroll;

    isProgrammaticScrollRef.current = true;
    track.scrollTo({ left: targetScroll, behavior: 'smooth' });

    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      updateScrollState();
    }, 550);
  };

  const handleScrollPrev = () => {
    const track = trackRef.current;
    if (!track) return;

    const currentScroll = track.scrollLeft;
    if (currentScroll <= 5) return;

    const viewportWidth = track.clientWidth;
    const items = Array.from(track.querySelectorAll('.product-card-item, .rudraksha-card-item'));
    if (items.length === 0) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    const idealScroll = Math.max(0, currentScroll - viewportWidth);
    const candidates = items.filter(item => item.offsetLeft < currentScroll - 5);

    if (candidates.length === 0) {
      isProgrammaticScrollRef.current = true;
      track.scrollTo({ left: 0, behavior: 'smooth' });
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        updateScrollState();
      }, 550);
      return;
    }

    let bestItem = candidates[0];
    let minDiff = Math.abs(bestItem.offsetLeft - idealScroll);

    for (let i = 1; i < candidates.length; i++) {
      const diff = Math.abs(candidates[i].offsetLeft - idealScroll);
      if (diff <= minDiff) {
        minDiff = diff;
        bestItem = candidates[i];
      }
    }

    let targetScroll = bestItem.offsetLeft;
    if (targetScroll >= currentScroll - 5) {
      const prevCandidate = candidates[candidates.length - 1];
      targetScroll = prevCandidate ? prevCandidate.offsetLeft : 0;
    }

    isProgrammaticScrollRef.current = true;
    track.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });

    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      updateScrollState();
    }, 550);
  };

  // Keyboard navigation on track
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleScrollNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleScrollPrev();
    }
  };

  // Optional smooth mouse drag scrolling for desktop
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const targetTag = (e.target.tagName || '').toLowerCase();
    if (['button', 'a', 'input', 'select', 'textarea'].includes(targetTag) || e.target.closest('button, a')) {
      return;
    }
    const track = trackRef.current;
    if (!track || !canScroll) return;

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - track.offsetLeft;
    scrollLeftRef.current = track.scrollLeft;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const track = trackRef.current;
    if (!track) return;
    const x = e.pageX - track.offsetLeft;
    const walk = (x - startXRef.current);
    if (Math.abs(walk) > 5) {
      hasDraggedRef.current = true;
    }
    track.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="product-carousel-wrapper">
      <div
        ref={trackRef}
        className={`product-carousel-track${!canScroll ? ' no-scroll' : ''}`}
        tabIndex={canScroll ? 0 : -1}
        role="region"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {products && products.length > 0 ? (
          products.map(product => (
            <div
              key={product.id}
              data-product-id={product.id}
              className="product-card-item"
            >
              <ProductCard
                product={product}
                showDesc={false}
                isSelected={selectedId ? product.id === selectedId : false}
              />
            </div>
          ))
        ) : (
          <div
            className="empty-category-msg"
            style={{
              width: '100%',
              textAlign: 'center',
              padding: '48px 16px',
              color: 'var(--text-secondary, #6b584e)',
              fontSize: '15px',
              fontWeight: 500,
            }}
          >
            {emptyMessage}
          </div>
        )}
      </div>

      {canScroll && products && products.length > 0 && (
        <div className="product-carousel-nav-controls">
          <button
            type="button"
            className="product-carousel-nav-btn prev"
            onClick={handleScrollPrev}
            disabled={isAtStart}
            aria-label="Previous products"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="product-carousel-nav-btn next"
            onClick={handleScrollNext}
            disabled={isAtEnd}
            aria-label="Next products"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

