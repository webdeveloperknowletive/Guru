'use client';
import { useStore } from '@/context/StoreContext';

const articleImageMap = [
  {
    match: ['5 मुखी', 'रुद्राक्ष', 'rudraksha'],
    image: '/Five-Mukhi Rudraksha in Golden Light-1.png',
    alt: '5 मुखी रुद्राक्ष - Five-Mukhi Rudraksha bead with prayer mala and brass lamp in warm sacred lighting',
  },
  {
    match: ['रत्न निवडताना', 'रत्न', 'gemstone'],
    image: '/Gemstones under a jeweler’s loupe-3.png',
    alt: 'रत्न निवडताना काय पाहावे - Colorful natural certified gemstones arranged with jeweler loupe',
  },
  {
    match: ['श्री यंत्र', 'yantra', 'यंत्र'],
    image: '/Golden Shri Yantra on an Ivory Altar-2.png',
    alt: 'श्री यंत्र म्हणजे काय - Sacred golden Shri Yantra plate placed on altar with marigold flowers',
  },
  {
    match: ['रुद्राभिषेक', 'rudrabhishek', 'shiva', 'लिंग'],
    image: '/Shiva lingam ritual water offering-4.png',
    alt: 'रुद्राभिषेकाचे महत्त्व - Shiva lingam with sacred holy water poured from brass pot and white flowers',
  },
];

function getArticleImage(title = '', existingCover = null) {
  if (existingCover && !existingCover.includes('default') && !existingCover.includes('placeholder')) {
    return { image: existingCover, alt: title };
  }
  const t = (title || '').toLowerCase();
  for (const item of articleImageMap) {
    if (item.match.some(m => t.includes(m.toLowerCase()))) {
      return { image: item.image, alt: item.alt };
    }
  }
  return { image: null, alt: title };
}

const defaultBlogs = [
  {
    tag: 'Rudraksha',
    title: '5 मुखी रुद्राक्षाचे पारंपरिक महत्त्व',
    excerpt: 'शिवाच्या अश्रूंपासून जन्मलेला 5 मुखी रुद्राक्ष — कल्याण, शांती आणि सत्याचे प्रतीक.',
    time: '5 min read',
    image: '/Five-Mukhi Rudraksha in Golden Light-1.png',
    alt: '5 मुखी रुद्राक्ष - Five-Mukhi Rudraksha bead with prayer mala and brass lamp in warm sacred lighting',
    icon: (
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="url(#auraGold)" opacity=".5"/>
        <circle cx="50" cy="50" r="26" fill="none" stroke="#e0b04a" strokeWidth="2"/>
        <text x="50" y="60" textAnchor="middle" fontFamily="'Tiro Devanagari Sanskrit',serif" fontSize="24" fill="#f7dc9a">रु</text>
      </svg>
    )
  },
  {
    tag: 'Ratna',
    title: 'रत्न निवडताना काय पाहावे?',
    excerpt: 'प्रत्येक रत्न सर्वांसाठी योग्य नसते. कुंडली, ग्रह स्थिती आणि जीवनशैली विचारात घेऊन रत्न कसे निवडावे.',
    time: '7 min read',
    image: '/Gemstones under a jeweler’s loupe-3.png',
    alt: 'रत्न निवडताना काय पाहावे - Colorful natural certified gemstones arranged with jeweler loupe',
    icon: (
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="url(#auraGold)" opacity=".5"/>
        <polygon points="50,20 80,45 70,80 30,80 20,45" fill="none" stroke="#7ee2b8" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" fontFamily="'Tiro Devanagari Sanskrit',serif" fontSize="20" fill="#7ee2b8">प</text>
      </svg>
    )
  },
  {
    tag: 'Yantra',
    title: 'श्री यंत्र म्हणजे काय?',
    excerpt: 'लक्ष्मीचे प्रतीक श्री यंत्र — कसे तयार होते, कसे स्थापित करावे आणि घरात कुठे ठेवावे.',
    time: '6 min read',
    image: '/Golden Shri Yantra on an Ivory Altar-2.png',
    alt: 'श्री यंत्र म्हणजे काय - Sacred golden Shri Yantra plate placed on altar with marigold flowers',
    icon: (
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="url(#auraGold)" opacity=".5"/>
        <rect x="20" y="20" width="60" height="60" fill="none" stroke="#e0b04a" strokeWidth="2"/>
        <line x1="20" y1="20" x2="80" y2="80" stroke="#e0b04a" strokeWidth="1.5"/>
        <line x1="80" y1="20" x2="20" y2="80" stroke="#e0b04a" strokeWidth="1.5"/>
      </svg>
    )
  },
  {
    tag: 'Puja',
    title: 'रुद्राभिषेकाचे महत्त्व',
    excerpt: 'आरोग्य, मनःशांती आणि आध्यात्मिक उन्नतीसाठी रुद्राभिषेक का केला जातो — शास्त्र आणि पद्धत.',
    time: '4 min read',
    image: '/Shiva lingam ritual water offering-4.png',
    alt: 'रुद्राभिषेकाचे महत्त्व - Shiva lingam with sacred holy water poured from brass pot and white flowers',
    icon: (
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="url(#auraGold)" opacity=".5"/>
        <path d="M50 30 L30 70 L70 70 Z" fill="none" stroke="#ff8c2b" strokeWidth="2"/>
        <circle cx="50" cy="55" r="4" fill="#ff8c2b"/>
      </svg>
    )
  }
];

function getBlogIcon(tag = '') {
  const t = (tag || '').toLowerCase();
  if (t.includes('ratna') || t.includes('gem')) {
    return (
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="url(#auraGold)" opacity=".5"/>
        <polygon points="50,20 80,45 70,80 30,80 20,45" fill="none" stroke="#7ee2b8" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" fontFamily="'Tiro Devanagari Sanskrit',serif" fontSize="20" fill="#7ee2b8">प</text>
      </svg>
    );
  }
  if (t.includes('yantra')) {
    return (
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="url(#auraGold)" opacity=".5"/>
        <rect x="20" y="20" width="60" height="60" fill="none" stroke="#e0b04a" strokeWidth="2"/>
        <line x1="20" y1="20" x2="80" y2="80" stroke="#e0b04a" strokeWidth="1.5"/>
        <line x1="80" y1="20" x2="20" y2="80" stroke="#e0b04a" strokeWidth="1.5"/>
      </svg>
    );
  }
  if (t.includes('puja')) {
    return (
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="url(#auraGold)" opacity=".5"/>
        <path d="M50 30 L30 70 L70 70 Z" fill="none" stroke="#ff8c2b" strokeWidth="2"/>
        <circle cx="50" cy="55" r="4" fill="#ff8c2b"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="url(#auraGold)" opacity=".5"/>
      <circle cx="50" cy="50" r="26" fill="none" stroke="#e0b04a" strokeWidth="2"/>
      <text x="50" y="60" textAnchor="middle" fontFamily="'Tiro Devanagari Sanskrit',serif" fontSize="24" fill="#f7dc9a">रु</text>
    </svg>
  );
}

export default function BlogSection({ articles: initialArticles }) {
  const { openArticleModal } = useStore();

  const list = (initialArticles !== undefined && initialArticles !== null && initialArticles.length > 0)
    ? initialArticles.map(a => {
        const imageInfo = getArticleImage(a.title, a.cover_image);
        return {
          tag: a.category || (Array.isArray(a.tags) && a.tags[0]) || 'Spiritual',
          title: a.title,
          excerpt: a.excerpt || (a.content ? a.content.slice(0, 90) + '...' : ''),
          time: a.time || `${a.read_time_mins || 5} min read`,
          slug: a.slug,
          content: a.content,
          image: imageInfo.image,
          alt: imageInfo.alt,
          icon: a.icon || getBlogIcon(a.category || (Array.isArray(a.tags) && a.tags[0])),
        };
      })
    : defaultBlogs;

  return (
    <section id="blog">
      <div id="ebook" style={{ position: 'relative', top: '-60px' }} />
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">Knowledge Centre</span>
          <h2>Blog &amp; <em>Learn</em></h2>
          <p>रुद्राक्ष, रत्न, यंत्र आणि पूजा यांविषयी सखोल माहिती — शास्त्राधारित, सोप्या भाषेत.</p>
        </div>
        <div className="blog-grid">
          {list.map((b, idx) => (
            <article key={idx} className="blog-card reveal">
              <div className="blog-thumb">
                {b.image ? (
                  <img
                    src={b.image}
                    alt={b.alt || b.title}
                    className="blog-img"
                    loading="lazy"
                  />
                ) : (
                  b.icon
                )}
              </div>
              <div className="blog-body">
                <span className="blog-tag">{b.tag}</span>
                <h3 className="blog-title">{b.title}</h3>
                <p className="blog-excerpt">{b.excerpt}</p>
                <div className="blog-meta">
                  <span>{b.time}</span>
                  <button
                    type="button"
                    onClick={() => openArticleModal(b)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--gold-lt)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Read More →
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
