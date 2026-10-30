'use client';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { RUDRAKSHA } from '@/lib/products';
import ProductCard from '@/components/ProductCard';

const FILTERS = [
  { label: 'All · सर्व', value: 'all' },
  { label: '1 Mukhi', value: 'm1' },
  { label: '2 Mukhi', value: 'm2' },
  { label: '3 Mukhi', value: 'm3' },
  { label: '4 Mukhi', value: 'm4' },
  { label: '5 Mukhi', value: 'm5' },
  { label: '6 Mukhi', value: 'm6' },
  { label: '7 Mukhi', value: 'm7' },
  { label: '8 Mukhi', value: 'm8' },
  { label: '9 Mukhi', value: 'm9' },
  { label: '10 Mukhi', value: 'm10' },
  { label: '11 Mukhi', value: 'm11' },
  { label: '12 Mukhi', value: 'm12' },
  { label: '13 Mukhi', value: 'm13' },
  { label: '14 Mukhi', value: 'm14' },
  { label: 'Mala', value: 'mala' },
];

function getMukhiValueForProduct(product) {
  if (!product) return null;
  const cat = (product.cat || '').toLowerCase();
  const title = (product.title || '').toLowerCase();
  const desc = (product.desc || '').toLowerCase();
  const catLabel = (product.catLabel || '').toLowerCase();

  // 1. Mala check
  if (cat === 'mala' || title.includes('mala') || desc.includes('mala') || catLabel.includes('mala')) {
    return 'mala';
  }

  // 2. Direct cat code (e.g. 'm1' .. 'm14')
  for (let i = 1; i <= 14; i++) {
    if (cat === `m${i}` || cat === String(i)) {
      return `m${i}`;
    }
  }

  // 3. Attributes check (attributes.mukhi or attributes.Mukhi)
  const attrMukhi = product.attributes?.mukhi ?? product.attributes?.Mukhi;
  if (attrMukhi !== undefined && attrMukhi !== null) {
    const s = String(attrMukhi).trim();
    for (let i = 1; i <= 14; i++) {
      if (s === String(i) || new RegExp(`(^|[^0-9])${i}\\s*mukhi([^0-9]|$)`, 'i').test(s)) {
        return `m${i}`;
      }
    }
  }

  // 4. Exact word boundary regex on title, desc, catLabel
  for (let i = 1; i <= 14; i++) {
    const regex = new RegExp(`(^|[^0-9])${i}\\s*mukhi([^0-9]|$)`, 'i');
    if (regex.test(title) || regex.test(catLabel) || regex.test(desc)) {
      return `m${i}`;
    }
  }

  // 5. Special case for panchamukhi -> 5 Mukhi
  if (title.includes('panchamukhi') || desc.includes('panchamukhi')) {
    return 'm5';
  }

  return null;
}

function isProductMatch(product, filterValue) {
  if (!product) return false;
  if (filterValue === 'all') return true;
  const pMukhi = getMukhiValueForProduct(product);
  return pMukhi === filterValue;
}

export default function RudrakshaSection({ products, headerText }) {
  const [active, setActive] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const trackRef = useRef(null);
  const filterBarRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const rafIdRef = useRef(null);

  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);

  const kicker = headerText?.kicker || 'Rudraksha';
  const title = headerText?.title || 'रुद्राक्ष Collection';
  const subtitle = headerText?.subtitle || 'प्रत्येक रुद्राक्ष प्रमाणित स्रोतांकडून — मुखीनुसार, आकारानुसार आणि पारंपरिक महत्त्वानुसार.';

  // Exclude bracelet products from Rudraksha section & keep original sequence
  const sortedList = useMemo(() => {
    const rawList = products !== undefined && products !== null ? products : RUDRAKSHA;
    const list = rawList.filter(p => {
      const cat = (p.cat || '').toLowerCase();
      const t = (p.title || '').toLowerCase();
      return !cat.includes('bracelet') && !t.includes('bracelet');
    });

    return [...list].sort((a, b) => {
      const rankA = Number(a.display_rank ?? a.rank ?? 999);
      const rankB = Number(b.display_rank ?? b.rank ?? 999);
      if (rankA !== rankB) return rankA - rankB;
      return 0;
    });
  }, [products]);

  const updateArrowStates = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const currentScroll = track.scrollLeft;
    setIsAtStart(currentScroll <= 5);
    setIsAtEnd(currentScroll >= maxScroll - 5 || maxScroll <= 0);
  }, []);

  const detectProminentCard = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('.rudraksha-card-item'));
    if (cards.length === 0) return;

    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;

    let mostVisibleCard = null;
    let minDistanceToCenter = Infinity;
    let maxVisibleRatio = -1;

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const visibleLeft = Math.max(rect.left, trackRect.left);
      const visibleRight = Math.min(rect.right, trackRect.right);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);
      const visibleRatio = visibleWidth / rect.width;

      const cardCenter = rect.left + rect.width / 2;
      const distanceToCenter = Math.abs(cardCenter - trackCenter);

      if (visibleRatio >= 0.35) {
        if (distanceToCenter < minDistanceToCenter) {
          minDistanceToCenter = distanceToCenter;
          mostVisibleCard = card;
        }
      } else if (!mostVisibleCard && visibleRatio > maxVisibleRatio) {
        maxVisibleRatio = visibleRatio;
        mostVisibleCard = card;
      }
    }

    if (mostVisibleCard) {
      const prodId = mostVisibleCard.getAttribute('data-product-id');
      const product = sortedList.find(p => String(p.id) === String(prodId));
      if (product) {
        const mukhiVal = getMukhiValueForProduct(product);
        if (mukhiVal) {
          setActive(mukhiVal);
          setSelectedId(product.id);
        }
      }
    }
  }, [sortedList]);

  // Handle manual carousel scrolling
  const handleScroll = useCallback(() => {
    updateArrowStates();

    if (isProgrammaticScrollRef.current) return;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      detectProminentCard();
    });
  }, [updateArrowStates, detectProminentCard]);

  // Recalculate arrow states on resize & observe changes
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    updateArrowStates();

    track.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateArrowStates);

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateArrowStates();
      });
      resizeObserver.observe(track);
      Array.from(track.children).forEach(child => resizeObserver.observe(child));
    }

    return () => {
      track.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateArrowStates);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      clearTimeout(scrollTimeoutRef.current);
    };
  }, [updateArrowStates, handleScroll]);

  // Ensure active tab chip is in view when changed
  useEffect(() => {
    if (!filterBarRef.current) return;
    const activeChip = filterBarRef.current.querySelector('.filter-chip.active');
    if (activeChip && typeof activeChip.scrollIntoView === 'function') {
      activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [active]);

  // Click on category tab: navigate to matching product
  const handleTabClick = (val) => {
    setActive(val);

    if (val === 'all') {
      setSelectedId(null);
      if (trackRef.current) {
        isProgrammaticScrollRef.current = true;
        trackRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
          updateArrowStates();
        }, 550);
      }
      return;
    }

    const targetProduct = sortedList.find(p => isProductMatch(p, val));
    if (!targetProduct) return;

    setSelectedId(targetProduct.id);

    if (trackRef.current) {
      const cardEl = trackRef.current.querySelector(`[data-product-id="${targetProduct.id}"]`);
      if (cardEl) {
        isProgrammaticScrollRef.current = true;
        const track = trackRef.current;
        const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
        const targetScroll = Math.max(0, Math.min(cardEl.offsetLeft, maxScroll));

        track.scrollTo({ left: targetScroll, behavior: 'smooth' });

        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
          updateArrowStates();
        }, 550);
      }
    }
  };

  const handleScrollNext = () => {
    const track = trackRef.current;
    if (!track) return;

    const currentScroll = track.scrollLeft;
    const viewportWidth = track.clientWidth;
    const maxScroll = Math.max(0, track.scrollWidth - viewportWidth);
    if (currentScroll >= maxScroll - 3) return;

    const items = Array.from(track.querySelectorAll('.rudraksha-card-item'));
    if (items.length === 0) return;

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
      updateArrowStates();
      detectProminentCard();
    }, 550);
  };

  const handleScrollPrev = () => {
    const track = trackRef.current;
    if (!track) return;

    const currentScroll = track.scrollLeft;
    if (currentScroll <= 5) return;

    const viewportWidth = track.clientWidth;
    const items = Array.from(track.querySelectorAll('.rudraksha-card-item'));
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
        updateArrowStates();
        detectProminentCard();
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
      updateArrowStates();
      detectProminentCard();
    }, 550);
  };

  return (
    <section id="rudraksha">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">{kicker}</span>
          <h2>
            {title === 'रुद्राक्ष Collection' ? (
              <>रुद्राक्ष <em>Collection</em></>
            ) : (
              title
            )}
          </h2>
          <p>{subtitle}</p>
        </div>

        <div className="filter-bar" ref={filterBarRef}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              className={`filter-chip${active === f.value ? ' active' : ''}`}
              onClick={() => handleTabClick(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="rudraksha-carousel-wrapper">
          <div
            ref={trackRef}
            className="rudraksha-carousel-track"
            tabIndex={0}
            role="region"
            aria-label="Rudraksha products carousel"
          >
            {sortedList.length > 0 ? (
              sortedList.map(product => (
                <div
                  key={product.id}
                  data-product-id={product.id}
                  className="rudraksha-card-item"
                >
                  <ProductCard
                    product={product}
                    showDesc={false}
                    isSelected={product.id === selectedId}
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
                No products available in this category.
              </div>
            )}
          </div>

          {sortedList.length > 0 && (
            <div className="rudraksha-nav-controls">
              <button
                type="button"
                className="rudraksha-nav-btn prev"
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
                className="rudraksha-nav-btn next"
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
      </div>
    </section>
  );
}
