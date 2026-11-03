import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProductDetail, getProducts, getSiteText } from '@/lib/api';
import { adaptApiProduct } from '@/lib/products';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import ScrollToTop from '@/components/ScrollToTop';
import ProductPageClient from '@/components/ProductPageClient';
import ProductCard from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';

  if (!slug) {
    return { title: 'Product | Swami Guruji' };
  }

  try {
    const p = await getProductDetail(slug);
    if (!p || p.error || !p.name) {
      return {
        title: 'Product Not Found | Swami Guruji',
        robots: { index: false, follow: false },
      };
    }

    const title = `${p.name} | Swami Guruji`;
    const desc = p.description || `${p.name}. View specifications, certification details, and pricing on Swami Guruji. Delivered across India.`;
    const canonical = `${baseUrl}/product/${p.slug}`;
    const imgUrl = p.thumbnail ? (p.thumbnail.startsWith('http') ? p.thumbnail : `${baseUrl}${p.thumbnail.startsWith('/') ? '' : '/'}${p.thumbnail}`) : `${baseUrl}/swami-guruji-logo-clean.png`;

    return {
      title,
      description: desc,
      alternates: {
        canonical,
      },
      openGraph: {
        title,
        description: desc,
        url: canonical,
        type: 'website',
        siteName: 'Swami Guruji',
        locale: 'mr_IN',
        alternateLocale: ['hi_IN', 'en_IN'],
        images: [
          {
            url: imgUrl,
            width: 800,
            height: 800,
            alt: p.name,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: desc,
        images: [imgUrl],
      },
      robots: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    };
  } catch (err) {
    return {
      title: 'Spiritual Product | Swami Guruji',
    };
  }
}

export default async function ProductDetailPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug) {
    notFound();
  }

  const [productRes, productsRes, siteTextRes] = await Promise.all([
    getProductDetail(slug).catch(() => null),
    getProducts().catch(() => null),
    getSiteText().catch(() => null),
  ]);

  if (!productRes || productRes.error || !productRes.name) {
    notFound();
  }

  const product = adaptApiProduct(productRes);
  if (!product) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';
  const siteText = siteTextRes || {};
  const logoUrl = siteText.logo_url || '/swami-guruji-logo-cropped.jpg';

  // Find related products in the same category
  const rawProducts = productsRes?.products || [];
  const allAdapted = rawProducts.map(adaptApiProduct).filter(Boolean);
  const relatedProducts = allAdapted
    .filter(p => p.slug !== product.slug && (p.cat === product.cat || p.catLabel === product.catLabel))
    .slice(0, 4);

  // If few related in same category, backfill with top-ranked products
  if (relatedProducts.length < 4) {
    const additional = allAdapted
      .filter(p => p.slug !== product.slug && !relatedProducts.some(r => r.slug === p.slug))
      .slice(0, 4 - relatedProducts.length);
    relatedProducts.push(...additional);
  }

  // Schema.org Product & Offer structured data
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.desc,
    sku: product.sku || undefined,
    image: Array.isArray(product.images) && product.images.length > 0
      ? product.images.map(img => img.startsWith('http') ? img : `${baseUrl}${img.startsWith('/') ? '' : '/'}${img}`)
      : undefined,
    category: product.catLabel || 'Spiritual Articles',
    brand: {
      '@type': 'Brand',
      name: 'Swami Guruji',
    },
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/product/${product.slug}`,
      priceCurrency: 'INR',
      price: product.priceNum,
      availability: product.is_in_stock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Swami Guruji',
      },
    },
  };

  // Devotee reviews aggregate if present
  if (productRes.reviews && productRes.reviews.length > 0) {
    productJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: productRes.average_rating || 5,
      reviewCount: productRes.review_count || productRes.reviews.length,
    };
    productJsonLd.review = productRes.reviews.slice(0, 5).map(rev => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: rev.customer_name || 'Devotee',
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: rev.rating || 5,
      },
      reviewBody: rev.comment,
    }));
  }

  // Schema.org BreadcrumbList structured data
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: product.catLabel || 'Sacred Collection',
        item: `${baseUrl}/#shop`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.title,
        item: `${baseUrl}/product/${product.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <TopBar
        contactLink={siteText.topbar_contact_link || '#contact'}
        contactText={siteText.topbar_contact_text || 'Contact Guruji Seva'}
      />

      <Navbar logo={logoUrl} />

      <main className="product-page-main">
        <div className="product-page-container">
          {/* Breadcrumb Navigation */}
          <nav className="product-breadcrumb-bar" aria-label="Breadcrumb">
            <Link href="/" className="crumb-link">Home</Link>
            <span className="crumb-sep">/</span>
            <Link href="/#shop" className="crumb-link">Shop Collections</Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-link">{product.catLabel || 'Spiritual'}</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current" aria-current="page">{product.title}</span>
          </nav>

          {/* Core Interactive Product Experience */}
          <ProductPageClient product={product} liveDetails={productRes} />

          {/* Related Spiritual Articles */}
          {relatedProducts.length > 0 && (
            <section className="product-related-section">
              <div className="sec-head center reveal">
                <span className="kicker">Divine Complements</span>
                <h2>Sacred Recommendations</h2>
                <p>Authentic spiritual articles traditionally harmonized with your selection.</p>
              </div>
              <div className="related-products-grid">
                {relatedProducts.map(rp => (
                  <ProductCard key={rp.id || rp.slug} product={rp} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer logo={logoUrl} footerText={siteText.footer_section} />
      <WhatsAppFloat />
      <ScrollToTop />
    </>
  );
}

