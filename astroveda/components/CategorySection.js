'use client';
import { useState } from 'react';

const defaultCategories = [
  { href: '#rudraksha', title: 'Rudraksha', desc: 'Authentic certified Nepali and Indonesian sacred Rudraksha beads', slug: 'rudraksha' },
  { href: '#ratna', title: 'Ratna & Gemstones', desc: 'Natural astrological gemstones certified by recognized gemological labs', slug: 'ratna' },
  { href: '#yantra', title: 'Yantra', desc: 'Vedic energized yantras in pure copper, silver, and ashtadhatu', slug: 'yantra' },
  { href: '#bracelets', title: 'Spiritual Bracelets', desc: 'Handcrafted healing crystal and sacred bead bracelets', slug: 'bracelets' },
  { href: '#puja-samagri', title: 'Puja Samagri', desc: 'Organic hawan samagri, brass diyas, and authentic pooja essentials', slug: 'puja-samagri' },
];

function getCategoryBgImage(cat = {}) {
  const s = `${cat.slug || ''} ${cat.name || ''} ${cat.title || ''}`.toLowerCase();
  if (s.includes('rudraksha')) return '/categories/rudraksha.png';
  if (s.includes('ratna') || s.includes('gemstone')) return '/categories/ratna.png';
  if (s.includes('yantra')) return '/categories/yantra.png';
  if (s.includes('bracelet')) return '/categories/bracelets.png';
  if (s.includes('samagri') || s.includes('puja')) return '/categories/puja-samagri.jpg';
  if (s.includes('special') || s.includes('collection')) return '/categories/special-collections.jpg';
  return '/categories/rudraksha.png';
}

export default function CategorySection({ categories: initialCategories, headerText }) {
  const [showAll, setShowAll] = useState(false);
  const [selectedSection, setSelectedSection] = useState('even');

  const categories = (initialCategories && initialCategories.length > 0)
    ? initialCategories.map(c => ({
        href: `#${c.slug || 'shop'}`,
        title: c.name || c.title,
        desc: c.description || c.desc || 'प्रमाणित स्रोतांकडून आणि शास्त्रोक्त पद्धतीने अभिमंत्रित.',
        slug: c.slug,
      }))
    : defaultCategories;

  const kicker = headerText?.kicker || 'Shop by Category';
  const title = headerText?.title || 'The Right Choice for You';
  const subtitle = headerText?.subtitle || 'Every category is traditionally curated — with astrological guidance, from certified sources.';

  // If odd count (e.g. 5 categories), default to even 4 cards unless showAll or a specific category is requested
  const isOddCount = categories.length % 2 !== 0 && categories.length > 4;
  const isEvenDisplay = !showAll && selectedSection === 'even' && isOddCount;
  const displayedCategories = isEvenDisplay ? categories.slice(0, 4) : categories;

  const handleSectionSelect = (slug) => {
    setSelectedSection(slug);
    if (slug === 'even') {
      setShowAll(false);
      return;
    }
    if (slug === 'all') {
      setShowAll(true);
      return;
    }
    // Show all so that the selected section card is visible
    setShowAll(true);
    // Smooth scroll to the corresponding section on page
    if (typeof document !== 'undefined') {
      const targetEl = document.getElementById(slug);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section id="shop">
      <div className="wrap">
        <div className="cat-sec-header reveal">
          <div className="sec-head">
            <span className="kicker">{kicker}</span>
            <h2>
              {title === 'The Right Choice for You' ? (
                <>The <em>Right Choice</em> for You</>
              ) : (
                title
              )}
            </h2>
            <p>{subtitle}</p>
          </div>

          <div className="cat-top-corner-actions">
            <div className="cat-dropdown-container">
              {/* <label htmlFor="cat-section-select" className="cat-select-label">
                View Section:
              </label> */}
              {/* <select
                id="cat-section-select"
                className="cat-section-select"
                value={selectedSection}
                onChange={(e) => handleSectionSelect(e.target.value)}
                aria-label="Select section to view"
              >
                <option value="even">✦ Featured (4 Even Cards)</option>
                <option value="all">✦ All Categories ({categories.length} Cards)</option>
                <optgroup label="Section Products">
                  {categories.map((cat) => (
                    <option key={cat.slug || cat.title} value={cat.slug}>
                      {cat.title}
                    </option>
                  ))}
                </optgroup>
              </select> */}
            </div>

            {isOddCount && (
              <button
                type="button"
                className="cat-view-toggle-btn"
                onClick={() => {
                  const nextState = !showAll;
                  setShowAll(nextState);
                  setSelectedSection(nextState ? 'all' : 'even');
                }}
              >
                {showAll
                  ? (headerText?.collapse_text || 'Show 4 Even Cards')
                  : `${headerText?.btn_text || 'View All'} (${categories.length}) →`}
              </button>
            )}
          </div>
        </div>

        <div className={`cat-grid${displayedCategories.length === 5 ? ' is-five' : ''}`}>
          {displayedCategories.map((cat) => {
            const bgImage = getCategoryBgImage(cat);
            return (
              <a
                key={cat.title}
                href={cat.href}
                className="cat-card reveal"
                style={{
                  backgroundImage: `url("${bgImage}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                <div className="cat-card-content">
                  <h3 className="cat-title">{cat.title}</h3>
                  <p className="cat-desc">{cat.desc}</p>
                  <span className="cat-link">Explore →</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
