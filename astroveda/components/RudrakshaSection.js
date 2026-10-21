'use client';
import { useState } from 'react';
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

function matchesMukhi(product, num) {
  const cat = (product.cat || '').toLowerCase();
  const title = (product.title || '').toLowerCase();
  const desc = (product.desc || '').toLowerCase();
  const catLabel = (product.catLabel || '').toLowerCase();

  // 1. Direct category match
  if (cat === `m${num}` || cat === String(num)) return true;

  // 2. Attributes check
  const attrMukhi = product.attributes?.mukhi ?? product.attributes?.Mukhi;
  if (attrMukhi !== undefined && attrMukhi !== null) {
    if (String(attrMukhi).trim() === String(num)) return true;
  }

  // 3. Exact word boundary regex: e.g. "1 mukhi" must not match "11 mukhi"
  const regex = new RegExp(`(^|[^0-9])${num}\\s*mukhi([^0-9]|$)`, 'i');
  if (regex.test(title) || regex.test(desc) || regex.test(catLabel)) {
    return true;
  }

  // 4. Special case for 5 mukhi / panchamukhi
  if (String(num) === '5') {
    if (title.includes('panchamukhi') || desc.includes('panchamukhi')) {
      return true;
    }
  }

  return false;
}

export default function RudrakshaSection({ products }) {
  const [active, setActive] = useState('all');
  const rawList = products !== undefined && products !== null ? products : RUDRAKSHA;

  // Exclude bracelet products from Rudraksha section
  const list = rawList.filter(p => {
    const cat = (p.cat || '').toLowerCase();
    const title = (p.title || '').toLowerCase();
    return !cat.includes('bracelet') && !title.includes('bracelet');
  });

  const filtered = [...(active === 'all'
    ? list
    : list.filter(p => {
        if (active === 'mala') {
          const cat = (p.cat || '').toLowerCase();
          const title = (p.title || '').toLowerCase();
          const desc = (p.desc || '').toLowerCase();
          return cat === 'mala' || title.includes('mala') || desc.includes('mala');
        }
        if (active.startsWith('m')) {
          const num = active.slice(1);
          return matchesMukhi(p, num);
        }
        return (p.cat || '').toLowerCase() === active;
      })
  )].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  return (
    <section id="rudraksha">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">Rudraksha</span>
          <h2>रुद्राक्ष <em>Collection</em></h2>
          <p>प्रत्येक रुद्राक्ष प्रमाणित स्रोतांकडून — मुखीनुसार, आकारानुसार आणि पारंपरिक महत्त्वानुसार.</p>
        </div>
        <div className="filter-bar">
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
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
            <div
              className="empty-category-msg"
              style={{
                gridColumn: '1 / -1',
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
      </div>
    </section>
  );
}
