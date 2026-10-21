import { YANTRA } from '@/lib/products';
import ProductCard from '@/components/ProductCard';

export default function YantraSection({ products }) {
  const list = products !== undefined && products !== null ? products : YANTRA;
  const sortedProducts = [...list].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  return (
    <section id="yantra">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">Yantra</span>
          <h2>Sacred <em>Yantra</em> Collection</h2>
          <p>तांब्यात हस्तनिर्मित यंत्र — अभिमंत्रण, प्राणप्रतिष्ठा व स्थापना मार्गदर्शनासह.</p>
        </div>
        <div className="prod-grid">
          {sortedProducts.map(product => (
            <ProductCard key={product.id} product={product} showDesc={false} />
          ))}
        </div>
      </div>
    </section>
  );
}
