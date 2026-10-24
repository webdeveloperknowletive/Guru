'use client';
import { useState } from 'react';
import { BRACELETS } from '@/lib/products';
import ProductCard from '@/components/ProductCard';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Spiritual Bracelets', value: 'spi' },
  { label: 'Combination Bracelets', value: 'combo' },
];

export default function BraceletsSection({ products, headerText }) {
  const [active, setActive] = useState('all');
  const rawList = products !== undefined && products !== null ? products : BRACELETS;

  const kicker = headerText?.kicker || 'Bracelets';
  const title = headerText?.title || 'Spiritual Bracelets';
  const subtitle = headerText?.subtitle || 'रुद्राक्ष, रत्न आणि संयोजन ब्रेसलेट — प्रत्येकासाठी धारण मार्गदर्शनासह.';

  const list = rawList.filter(p => {
    const isRudraksha = p.cat === 'rud' || p.sku === 'BRC-RUD' || p.title?.toLowerCase().includes('rudraksha');
    return !isRudraksha;
  });
  const filtered = [...(active === 'all'
    ? list
    : list.filter(p => {
        const cat = (p.cat || '').toLowerCase();
        const title = (p.title || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        if (active === 'combo') {
          return (
            cat === 'combo' ||
            title.includes('combo') ||
            title.includes('navagraha') ||
            title.includes('multicolor') ||
            title.includes('multi') ||
            title.includes('mixed') ||
            title.includes('citrine') ||
            title.includes('money') ||
            title.includes('magnet') ||
            sku.includes('com') ||
            sku.includes('nav') ||
            sku.includes('mmg') ||
            sku.includes('mlt')
          );
        }
        if (active === 'spi') {
          const isCombo =
            cat === 'combo' ||
            title.includes('combo') ||
            title.includes('navagraha') ||
            title.includes('multicolor') ||
            title.includes('money') ||
            title.includes('magnet') ||
            sku.includes('mmg') ||
            sku.includes('mlt');
          return !isCombo;
        }
        return cat === active;
      })
  )].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  return (
    <section id="bracelets">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">{kicker}</span>
          <h2>
            {title === 'Spiritual Bracelets' ? (
              <>Spiritual <em>Bracelets</em></>
            ) : (
              title
            )}
          </h2>
          <p>{subtitle}</p>
        </div>
        <div className="filter-bar">
          {FILTERS.map(f => (
            <button
              key={f.value}
              className={`filter-chip${active === f.value ? ' active' : ''}`}
              onClick={() => setActive(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="prod-grid">
          {filtered.length > 0 ? (
            filtered.map(product => (
              <ProductCard key={product.id} product={product} showDesc={false} />
            ))
          ) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '13px' }}>
              या श्रेणीतील ब्रेसलेट्स लवकरच उपलब्ध होतील. (Products in this category will be available soon).
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
