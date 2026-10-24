import { FEATURED } from '@/lib/products';
import ProductCard from '@/components/ProductCard';

export default function FeaturedSection({ products, headerText }) {
  const list = products !== undefined && products !== null ? products : FEATURED;
  const sortedProducts = [...list].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  const kicker = headerText?.kicker || 'Featured';
  const title = headerText?.title || 'Our Sacred Collection';
  const subtitle = headerText?.subtitle || 'सर्वाधिक मागणी असलेली उत्पादने — प्रमाणित, अभिमंत्रित आणि पूर्ण मार्गदर्शनासह.';

  return (
    <section id="featured">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">{kicker}</span>
          <h2>
            {title === 'Our Sacred Collection' ? (
              <>Our <em>Sacred</em> Collection</>
            ) : (
              title
            )}
          </h2>
          <p>{subtitle}</p>
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
