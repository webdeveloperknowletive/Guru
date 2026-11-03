import { YANTRA } from '@/lib/products';
import ProductCarousel from '@/components/ProductCarousel';

export default function YantraSection({ products, headerText }) {
  const list = products !== undefined && products !== null ? products : YANTRA;
  const sortedProducts = [...list].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  const kicker = headerText?.kicker || 'Yantra';
  const title = headerText?.title || 'Sacred Yantra Collection';
  const subtitle = headerText?.subtitle || 'तांब्यात हस्तनिर्मित यंत्र — अभिमंत्रण, प्राणप्रतिष्ठा व स्थापना मार्गदर्शनासह.';

  return (
    <section id="yantra">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">{kicker}</span>
          <h2>
            {title === 'Sacred Yantra Collection' ? (
              <>Sacred <em>Yantra</em> Collection</>
            ) : (
              title
            )}
          </h2>
          <p>{subtitle}</p>
        </div>

        <ProductCarousel
          products={sortedProducts}
          ariaLabel="Sacred Yantra Collection carousel"
          emptyMessage="No yantras currently available."
        />
      </div>
    </section>
  );
}
