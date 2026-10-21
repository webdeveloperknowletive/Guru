import ProductCard from '@/components/ProductCard';

export default function PujaSamagriSection({ products = [] }) {
  if (!products || products.length === 0) return null;

  const sortedProducts = [...products].sort((a, b) => {
    const rankA = Number(a.display_rank ?? a.rank ?? 999);
    const rankB = Number(b.display_rank ?? b.rank ?? 999);
    if (rankA !== rankB) return rankA - rankB;
    return 0;
  });

  return (
    <section id="puja-samagri">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="kicker">Puja Samagri</span>
          <h2>Sacred <em>Puja Samagri</em> Collection</h2>
          <p>पूजा व धार्मिक विधींसाठी आवश्यक सर्व शुद्ध व प्रमाणित साहित्य — एकाच ठिकाणी.</p>
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
