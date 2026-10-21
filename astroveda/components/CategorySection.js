const defaultCategories = [
  { href: '#ratna', icon: '💎', title: 'Ratna', desc: 'ज्योतिषीय मार्गदर्शनानुसार निवडक रत्न — Ruby, Emerald, Blue Sapphire आणि अधिक.' },
  { href: '#rudraksha', icon: '📿', title: 'Rudraksha', desc: '1 ते 21 मुखी रुद्राक्ष, माळा आणि ब्रेसलेट — प्रमाणित व अभिमंत्रित.' },
  { href: '#bracelets', icon: '🪬', title: 'Bracelets', desc: 'आध्यात्मिक व पारंपरिक ब्रेसलेट — रत्न, रुद्राक्ष आणि संयोजन.' },
  { href: '#yantra', icon: '🔱', title: 'Yantra', desc: 'Shri Yantra, Kuber Yantra, Navgraha Yantra व इतर — अभिमंत्रित तांब्यात.' },
  { href: '#puja-samagri', icon: '🪔', title: 'Puja Samagri', desc: 'पूजा व धार्मिक विधींसाठी आवश्यक सर्व साहित्य — एकाच ठिकाणी.' },
  { href: '#special-collections', icon: '🎁', title: 'Special Collections', desc: 'विशेष पूजा, सण आणि gift collections — तुमच्या प्रसंगासाठी.' },
];

const iconMap = {
  'ratna': '💎',
  'gemstones': '💎',
  'rudraksha': '📿',
  'bracelets': '🪬',
  'yantra': '🔱',
  'puja-samagri': '🪔',
  'special-collections': '🎁',
};

export default function CategorySection({ categories: initialCategories }) {
  const categories = (initialCategories && initialCategories.length > 0)
    ? initialCategories.map(c => ({
        href: `#${c.slug || 'shop'}`,
        icon: iconMap[c.slug] || '✨',
        title: c.name,
        desc: c.description || 'प्रमाणित स्रोतांकडून आणि शास्त्रोक्त पद्धतीने अभिमंत्रित.',
      }))
    : defaultCategories;

  return (
    <section id="shop">
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">Shop by Category</span>
          <h2>The <em>Right Choice</em> for You</h2>
          <p>Every category is traditionally curated — with astrological guidance, from certified sources.</p>
        </div>
        <div className="cat-grid">
          {categories.map((cat) => (
            <a key={cat.title} href={cat.href} className="cat-card reveal">
              <div className="cat-icon">{cat.icon}</div>
              <h3 className="cat-title">{cat.title}</h3>
              <p className="cat-desc">{cat.desc}</p>
              <span className="cat-link">Explore →</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
