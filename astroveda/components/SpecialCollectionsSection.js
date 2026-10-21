import ProductCard from '@/components/ProductCard';

export default function SpecialCollectionsSection({ products = [] }) {
  if (!products || products.length === 0) return null;

  const sortedProducts = [...products].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  return (
    <section id="special-collections">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">Special Collections</span>
          <h2>Sacred <em>Special Collections</em></h2>
          <p>विशेष पूजा, सण आणि gift sets — तुमच्या शुभ प्रसंगासाठी प्रमाणित व अभिमंत्रित.</p>
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
