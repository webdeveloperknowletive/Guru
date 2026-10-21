import { RATNA } from '@/lib/products';
import ProductCard from '@/components/ProductCard';

export default function RatnaSection({ products }) {
  const list = products !== undefined && products !== null ? products : RATNA;
  const sortedProducts = [...list].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  return (
    <section id="ratna">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">Ratna</span>
          <h2>Choose Your <em>Gemstone</em> With Guidance</h2>
          <p>प्रत्येक रत्न IGI / GIA प्रमाणित. पण रत्न निवड ही वैयक्तिक बाब आहे — म्हणून आम्ही मार्गदर्शन देतो.</p>
        </div>
        <div className="prod-grid">
          {sortedProducts.map(product => (
            <ProductCard key={product.id} product={product} showDesc={false} />
          ))}
        </div>
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <a href="#jyotish" className="btn btn-gold" style={{ padding: '14px 24px', whiteSpace: 'normal', maxWidth: '100%', lineHeight: 1.4, textAlign: 'center' }}>
            Not sure which gemstone is right for you? · Get Gemstone Consultation →
          </a>
        </div>
      </div>
    </section>
  );
}
