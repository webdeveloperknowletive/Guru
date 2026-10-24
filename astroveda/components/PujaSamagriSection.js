import ProductCard from '@/components/ProductCard';

export default function PujaSamagriSection({ products = [], headerText }) {
  if (!products || products.length === 0) return null;

  const sortedProducts = [...products].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  const kicker = headerText?.kicker || 'Puja Samagri';
  const title = headerText?.title || 'Sacred Puja Samagri Collection';
  const subtitle = headerText?.subtitle || 'पूजा व धार्मिक विधींसाठी आवश्यक सर्व शुद्ध व प्रमाणित साहित्य — एकाच ठिकाणी.';

  return (
    <section id="puja-samagri">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">{kicker}</span>
          <h2>
            {title === 'Sacred Puja Samagri Collection' ? (
              <>Sacred <em>Puja Samagri</em> Collection</>
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
