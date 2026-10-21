import { FEATURED } from '@/lib/products';
import ProductCard from '@/components/ProductCard';

export default function FeaturedSection({ products }) {
  const list = products !== undefined && products !== null ? products : FEATURED;
  const sortedProducts = [...list].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  return (
    <section id="featured">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">Featured</span>
          <h2>Our <em>Sacred</em> Collection</h2>
          <p>सर्वाधिक मागणी असलेली उत्पादने — प्रमाणित, अभिमंत्रित आणि पूर्ण मार्गदर्शनासह.</p>
        </div>
        <div className="prod-grid">
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} showDesc={false} />
          ))}
        </div>
      </div>
    </section>
  );
}
