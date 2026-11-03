import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCategories, getProducts, getSiteText } from '@/lib/api';
import { adaptApiProduct } from '@/lib/products';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import ScrollToTop from '@/components/ScrollToTop';
import ProductCard from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

const CATEGORY_META = {
  rudraksha: {
    kicker: 'Sacred Beads',
    h1: 'Sacred Rudraksha Collection',
    guideTitle: 'About Authentic Rudraksha',
    guideText: 'Sourced directly from certified providers in Nepal and Indonesia. In Vedic tradition, each Mukhi (face) of the Rudraksha bead channels distinct cosmic frequencies, promoting peace, vitality, and spiritual focus. Every bead is lab tested for genuine density, natural contours, and authenticity.',
  },
  ratna: {
    kicker: 'Jyotish Gemstones',
    h1: 'Certified Astrological Gemstones (Ratna)',
    guideTitle: 'About Vedic Astrological Gemstones',
    guideText: 'Natural, untreated, and eye-clean gemstones tested by recognized gemological laboratories. In Vedic Jyotish, planetary gemstones amplify benefic cosmic rays to harmonize planetary influences and support clarity, health, and prosperity.',
  },
  yantra: {
    kicker: 'Sacred Sacred Geometry',
    h1: 'Energised Vedic Yantras',
    guideTitle: 'The Power of Sacred Geometry',
    guideText: 'Hand-crafted on pure copper, silver, and ashtadhatu plates. Yantras represent geometric representations of cosmic deities, traditionally sanctified through Pran-Pratishtha to generate a positive spiritual aura in homes and workplaces.',
  },
  bracelets: {
    kicker: 'Spiritual Adornment',
    h1: 'Sacred Gemstone & Crystal Bracelets',
    guideTitle: 'Everyday Spiritual Protection',
    guideText: 'Handcrafted with authentic natural crystal beads and sacred seeds. Designed for daily wear to maintain chakra balance, grounding, and mental calm while carrying the blessings of sacred stones.',
  },
  'puja-samagri': {
    kicker: 'Pooja Essentials',
    h1: 'Authentic Vedic Puja Samagri',
    guideTitle: 'Pure Ingredients for Sacred Rituals',
    guideText: 'Natural hawan herbs, pure cow ghee, sacred woods, and traditional brass ritual implements curated according to strict Vedic injunctions for flawless ritual sanctity.',
  },
};

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';

  if (!slug) return { title: 'Collections | Swami Guruji' };

  try {
    const catsRes = await getCategories();
    const categories = catsRes?.categories || [];
    const cat = categories.find(c => c.slug === slug);

    if (!cat) {
      return {
        title: 'Category Not Found | Swami Guruji',
        robots: { index: false, follow: false },
      };
    }

    const title = `${cat.name} Collection | Swami Guruji`;
    const desc = cat.description || `Explore authentic, certified ${cat.name} on Swami Guruji. Consecrated items delivered securely across India.`;
    const canonical = `${baseUrl}/category/${cat.slug}`;

    return {
      title,
      description: desc,
      alternates: { canonical },
      openGraph: {
        title,
        description: desc,
        url: canonical,
        type: 'website',
        siteName: 'Swami Guruji',
        locale: 'mr_IN',
        images: [{ url: cat.image_url || '/swami-guruji-logo-clean.png', alt: cat.name }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: desc,
        images: [cat.image_url || '/swami-guruji-logo-clean.png'],
      },
      robots: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    };
  } catch {
    return { title: 'Category | Swami Guruji' };
  }
}

export default async function CategoryPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug) notFound();

  const [categoriesRes, productsRes, siteTextRes] = await Promise.all([
    getCategories().catch(() => null),
    getProducts().catch(() => null),
    getSiteText().catch(() => null),
  ]);

  const allCategories = categoriesRes?.categories || [];
  const activeCategories = allCategories.filter(c => c.is_active !== false);
  const currentCategory = activeCategories.find(c => c.slug === slug);

  if (!currentCategory) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';
  const siteText = siteTextRes || {};
  const logoUrl = siteText.logo_url || '/swami-guruji-logo-cropped.jpg';

  // Filter products belonging to this category
  const rawProducts = productsRes?.products || [];
  const allAdapted = rawProducts.map(adaptApiProduct).filter(Boolean);
  const categoryProducts = allAdapted.filter(p => {
    const pCatSlug = String(p.attributes?.category_slug || p.cat || '').toLowerCase();
    const pCatLabel = String(p.catLabel || '').toLowerCase();
    const targetSlug = slug.toLowerCase();

    if (pCatSlug === targetSlug) return true;
    if (targetSlug === 'rudraksha' && (pCatSlug.startsWith('m') || pCatSlug === 'mala' || pCatLabel.includes('rudraksha'))) return true;
    if (targetSlug === 'ratna' && (pCatSlug === 'ratna' || pCatLabel.includes('gemstone') || pCatLabel.includes('ratna'))) return true;
    if (targetSlug === 'yantra' && (pCatSlug === 'yantra' || pCatLabel.includes('yantra'))) return true;
    if (targetSlug === 'bracelets' && (pCatSlug === 'bracelets' || pCatSlug === 'rud' || pCatSlug === 'gem' || pCatSlug === 'combo' || pCatSlug === 'spi' || pCatLabel.includes('bracelet'))) return true;
    if (targetSlug === 'puja-samagri' && (pCatSlug.includes('samagri') || pCatSlug.includes('puja') || pCatLabel.includes('samagri'))) return true;
    return false;
  });

  const metaContent = CATEGORY_META[slug] || {
    kicker: 'Spiritual Collection',
    h1: `${currentCategory.name} Collection`,
    guideTitle: `About ${currentCategory.name}`,
    guideText: currentCategory.description || 'Authentic, certified spiritual articles traditionally sourced and sanctified.',
  };

  // Structured Data: CollectionPage + ItemList
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${currentCategory.name} Collection`,
    description: currentCategory.description,
    url: `${baseUrl}/category/${currentCategory.slug}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: categoryProducts.length,
      itemListElement: categoryProducts.map((prod, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${baseUrl}/product/${prod.slug}`,
        name: prod.title,
      })),
    },
  };

  // BreadcrumbList
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Shop Collections', item: `${baseUrl}/#shop` },
      { '@type': 'ListItem', position: 3, name: currentCategory.name, item: `${baseUrl}/category/${currentCategory.slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
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

      <main className="category-page-main">
        <div className="category-page-container">
          {/* Breadcrumb Navigation */}
          <nav className="product-breadcrumb-bar" aria-label="Breadcrumb">
            <Link href="/" className="crumb-link">Home</Link>
            <span className="crumb-sep">/</span>
            <Link href="/#shop" className="crumb-link">Shop Collections</Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current" aria-current="page">{currentCategory.name}</span>
          </nav>

          {/* Category Header */}
          <header className="category-header-sec">
            <span className="category-kicker">{metaContent.kicker}</span>
            <h1 className="category-title-h1">{metaContent.h1}</h1>
            <p className="category-lead-text">{currentCategory.description}</p>
          </header>

          {/* Sibling Category Navigation Pills */}
          <div className="category-nav-pills">
            {activeCategories.map(cat => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className={`category-pill${cat.slug === slug ? ' active' : ''}`}
              >
                {cat.name}
              </Link>
            ))}
          </div>

          {/* Product Listing */}
          <section className="category-products-section">
            <div className="category-products-bar">
              <span className="products-count-badge">
                Showing {categoryProducts.length} certified items
              </span>
            </div>

            {categoryProducts.length > 0 ? (
              <div className="category-products-grid">
                {categoryProducts.map(product => (
                  <ProductCard key={product.id || product.slug} product={product} />
                ))}
              </div>
            ) : (
              <div className="category-empty-state">
                <p>New sacred batches currently undergoing certification. Please check back shortly.</p>
                <Link href="/" className="btn btn-gold">Back to Homepage</Link>
              </div>
            )}
          </section>

          {/* Category Guide & Knowledge */}
          <section className="category-guide-box">
            <h3>{metaContent.guideTitle}</h3>
            <p>{metaContent.guideText}</p>
            <div className="guide-trust-grid">
              <div className="guide-trust-item">
                <span className="gt-icon">🔬</span>
                <strong>Lab Certified</strong>
                <p>Tested for genuine origin, structure, and physical authenticity</p>
              </div>
              <div className="guide-trust-item">
                <span className="gt-icon">🪔</span>
                <strong>Traditional Sanctity</strong>
                <p>Consecrated in sacred Varanasi / Trimbakeshwar traditions</p>
              </div>
              <div className="guide-trust-item">
                <span className="gt-icon">📦</span>
                <strong>Insured Shipping</strong>
                <p>Delivered securely across India with Gangajal &amp; vibhuti</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer logo={logoUrl} footerText={siteText.footer_section} />
      <WhatsAppFloat />
      <ScrollToTop />
    </>
  );
}

