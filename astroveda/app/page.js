import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import PromoRibbon from '@/components/PromoRibbon';
import Hero from '@/components/Hero';
import CategorySection from '@/components/CategorySection';
import FeaturedSection from '@/components/FeaturedSection';
import PujaSection from '@/components/PujaSection';
import JyotishSection from '@/components/JyotishSection';
import RudrakshaSection from '@/components/RudrakshaSection';
import RatnaSection from '@/components/RatnaSection';
import YantraSection from '@/components/YantraSection';
import BraceletsSection from '@/components/BraceletsSection';
import PujaSamagriSection from '@/components/PujaSamagriSection';
import VideoSection from '@/components/VideoSection';
import WhySection from '@/components/WhySection';
import AboutSection from '@/components/AboutSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import BlogSection from '@/components/BlogSection';
import AdBannerSection from '@/components/AdBannerSection';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import ScrollToTop from '@/components/ScrollToTop';

import {
  getProducts,
  getCategories,
  getPujaServices,
  getTestimonials,
  getArticles,
  getBanners,
  getGurujiProfile,
  getSiteText,
  getSections,
} from '@/lib/api';

import { adaptApiProduct } from '@/lib/products';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  // Fetch live database records across all modules in parallel.
  const [
    productsRes,
    categoriesRes,
    pujaRes,
    testimonialsRes,
    articlesRes,
    heroBannerRes,
    gurujiRes,
    siteTextRes,
    sectionsRes,
  ] = await Promise.all([
    getProducts().catch(() => null),
    getCategories().catch(() => null),
    getPujaServices().catch(() => null),
    getTestimonials().catch(() => null),
    getArticles().catch(() => null),
    getBanners().catch(() => null),
    getGurujiProfile().catch(() => null),
    getSiteText().catch(() => null),
    getSections().catch(() => null),
  ]);

  // Adapt API products into the storefront UI format.
  const rawProducts = productsRes?.products || [];

  const allProducts = rawProducts
    .map(adaptApiProduct)
    .filter(Boolean)
    .sort((a, b) => {
      const rankA = Number(a.display_rank ?? a.rank ?? 999);
      const rankB = Number(b.display_rank ?? b.rank ?? 999);

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return 0;
    });

  // Sort product lists by display rank.
  const sortByRank = (arr) =>
    [...arr].sort((a, b) => {
      const rankA = Number(a.display_rank ?? a.rank ?? 999);
      const rankB = Number(b.display_rank ?? b.rank ?? 999);

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return 0;
    });

  // Rudraksha products.
  const rudrakshaProducts = sortByRank(
    allProducts.filter((p) => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();

      return (
        s.includes('rudraksha') ||
        s.includes('mukhi') ||
        s.includes('mala')
      );
    })
  );

  // Gemstone products.
  const ratnaProducts = sortByRank(
    allProducts.filter((p) => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();

      if (s.includes('bracelet')) {
        return false;
      }

      return (
        s.includes('ratna') ||
        s.includes('gemstone') ||
        s.includes('ruby') ||
        s.includes('sapphire') ||
        s.includes('emerald') ||
        s.includes('pearl') ||
        s.includes('coral') ||
        s.includes('panna') ||
        s.includes('manik') ||
        s.includes('neelam') ||
        s.includes('pukhraj') ||
        s.includes('moti') ||
        s.includes('moonga') ||
        s.includes('gomed') ||
        s.includes('hessonite') ||
        s.includes('vaidurya') ||
        s.includes('vedurya') ||
        s.includes("cat's eye") ||
        s.includes('diamond') ||
        s.includes('heera')
      );
    })
  );

  // Yantra products.
  const yantraProducts = sortByRank(
    allProducts.filter((p) => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();

      return s.includes('yantra');
    })
  );

  // Bracelet products.
  const braceletsProducts = sortByRank(
    allProducts.filter((p) => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();

      return s.includes('bracelet');
    })
  );

  // Puja Samagri products.
  const pujaSamagriProducts = sortByRank(
    allProducts.filter((p) => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();

      return (
        s.includes('puja') ||
        s.includes('samagri') ||
        s.includes('kalash') ||
        s.includes('diya') ||
        s.includes('incense') ||
        s.includes('dhoop') ||
        s.includes('hawan')
      );
    })
  );

  // Special collection products.
  const specialCollectionsProducts = sortByRank(
    allProducts.filter((p) => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();

      return (
        s.includes('special') ||
        s.includes('collection') ||
        s.includes('kit') ||
        s.includes('gift') ||
        s.includes('set')
      );
    })
  );

  // Featured selection.
  const featuredCandidates = sortByRank(
    allProducts.filter(
      (p) =>
        p.badge === 'hot' ||
        p.badge === 'new' ||
        p.badge === 'lab'
    )
  );

  const featuredProducts =
    featuredCandidates.length >= 4
      ? featuredCandidates.slice(0, 4)
      : allProducts.slice(0, 4);

  // -----------------------------------------------------------
  // Content records and admin-managed banners.
  // Supports multiple response shapes from the banners API.
  // -----------------------------------------------------------

  const allBanners = Array.isArray(heroBannerRes)
    ? heroBannerRes
    : Array.isArray(heroBannerRes?.banners)
      ? heroBannerRes.banners
      : Array.isArray(heroBannerRes?.data?.banners)
        ? heroBannerRes.data.banners
        : Array.isArray(heroBannerRes?.assets)
          ? heroBannerRes.assets
          : [];

  // Normalize banner placement names.
  // Example: "BACKGROUND IMG" becomes "background_img".
  const getBannerPosition = (banner) =>
    String(
      banner?.position ??
      banner?.placement ??
      banner?.role ??
      banner?.asset_type ??
      banner?.type ??
      ''
    )
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');

  // Support different possible banner image field names.
  const getBannerImage = (banner) => {
    const candidates = [
      banner?.image_url,
      banner?.asset_url,
      banner?.file_url,
      banner?.image,
      banner?.url,
      banner?.path,
      banner?.asset?.url,
      banner?.file?.url,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === 'string' &&
        candidate.trim()
      ) {
        return candidate.trim();
      }

      if (
        candidate &&
        typeof candidate === 'object'
      ) {
        const nested =
          candidate.url ??
          candidate.path ??
          candidate.src;

        if (
          typeof nested === 'string' &&
          nested.trim()
        ) {
          return nested.trim();
        }
      }
    }

    return '';
  };

  // Ignore disabled banners.
  const isBannerActive = (banner) => {
    if (
      banner?.is_active === false ||
      banner?.active === false
    ) {
      return false;
    }

    const status = String(
      banner?.status ?? ''
    )
      .trim()
      .toLowerCase();

    return ![
      'inactive',
      'disabled',
      'draft',
      'archived',
    ].includes(status);
  };

  const activeBanners = allBanners.filter(isBannerActive);

  const positionIs = (banner, values) =>
    values.includes(getBannerPosition(banner));

  // Standard hero content banner.
  const heroBanner =
    activeBanners.find((banner) =>
      positionIs(banner, [
        'hero',
        'hero_banner',
        'hero_section',
      ])
    ) || null;

  // Top announcement banners.
  const topbarBanners = activeBanners.filter((banner) =>
    positionIs(banner, [
      'topbar',
      'top_bar',
      'top_announcement',
      'announcement',
    ])
  );

  // Promotional ribbon.
  const promoBanner =
    activeBanners.find((banner) =>
      positionIs(banner, [
        'promo',
        'promo_ribbon',
        'promotional_ribbon',
        'promotional_banner',
      ])
    ) || null;

  // Logo or brand image.
  const logoBanner =
    activeBanners.find((banner) =>
      positionIs(banner, [
        'logo',
        'brand_logo',
        'site_logo',
      ])
    ) || null;

  // -----------------------------------------------------------
  // Image URL resolver.
  //
  // Keep uploaded /static paths relative to the public website.
  // The Next.js rewrite should forward /static/* to Flask.
  // This avoids exposing internal Docker service URLs.
  // -----------------------------------------------------------

  const resolveImg = (value) => {
    if (
      !value ||
      typeof value !== 'string'
    ) {
      return null;
    }

    const url = value.trim();

    if (!url) {
      return null;
    }

    if (/^https?:\/\//i.test(url)) {
      try {
        const parsed = new URL(url);

        // Uploaded static media should use the storefront origin.
        if (parsed.pathname.startsWith('/static/')) {
          return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      } catch {
        return null;
      }

      return url;
    }

    if (url.startsWith('static/')) {
      return `/${url}`;
    }

    if (url.startsWith('/static/')) {
      return url;
    }
    return url;
  };

  // Accepted hero background placement names.
  const backgroundPositions = [
    'hero_bg',
    'hero_background',
    'hero_background_image',
    'background_img',
    'background_image',
    'background',
    'bg_image',
    'site_background',
  ];

  // Select active background banners.
  const bgBanners = activeBanners.filter((banner) => {
    const position = getBannerPosition(banner);
    const hasImage = Boolean(getBannerImage(banner));

    return (
      backgroundPositions.includes(position) ||
      (
        positionIs(banner, [
          'hero',
          'hero_banner',
          'hero_section',
        ]) &&
        hasImage
      )
    );
  });

  const dynamicHeroSlides = bgBanners
    .map((banner) =>
      resolveImg(getBannerImage(banner))
    )
    .filter(Boolean);

  // Optional site-wide background image.
  const siteBgBanner =
    activeBanners.find((banner) =>
      positionIs(banner, [
        'site_background',
        'bg_image',
        'page_background',
      ])
    ) || null;

  const siteBgUrl = resolveImg(
    getBannerImage(siteBgBanner)
  );

  // Logo fallback.
  const logoUrl =
    resolveImg(getBannerImage(logoBanner)) ||
    '/swami-guruji-logo-cropped.jpg';

  // First admin-managed hero background image.
  const heroBgUrl = dynamicHeroSlides[0] || null;

  // -----------------------------------------------------------
  // Normalize fetched API responses.
  // -----------------------------------------------------------

  const categories = categoriesRes?.categories || [];
  const pujaServices = pujaRes?.puja_services || [];
  const testimonials = testimonialsRes?.testimonials || [];
  const articles = articlesRes?.articles || [];

  const guruji =
    gurujiRes?.guruji ||
    gurujiRes ||
    null;

  const siteText =
    siteTextRes?.site_text ||
    siteTextRes ||
    {};

  const topbarContactLink =
    siteText?.hero_section?.whatsapp_url ||
    siteText?.footer_section?.whatsapp_url ||
    'https://wa.me/919623117545';

  const topbarContactText =
    siteText?.hero_section?.contact_text ||
    'Talk to Guruji';

  // -----------------------------------------------------------
  // Dynamic homepage section configuration.
  // -----------------------------------------------------------

  const sectionsData = sectionsRes?.sections || [];

  const SECTION_COMPONENTS = {
    categories: (
      <CategorySection
        key="categories"
        categories={categories}
        headerText={siteText.category_section}
      />
    ),

    featured: (
      <FeaturedSection
        key="featured"
        products={featuredProducts}
        headerText={siteText.featured_section}
      />
    ),

    puja: (
      <PujaSection
        key="puja"
        services={pujaServices}
        headerText={siteText.puja_section}
      />
    ),

    jyotish: (
      <JyotishSection
        key="jyotish"
        sectionText={siteText.jyotish_section}
      />
    ),

    rudraksha: (
      <RudrakshaSection
        key="rudraksha"
        products={rudrakshaProducts}
        headerText={siteText.rudraksha_section}
      />
    ),

    ratna: (
      <RatnaSection
        key="ratna"
        products={ratnaProducts}
        headerText={siteText.ratna_section}
      />
    ),

    yantra: (
      <YantraSection
        key="yantra"
        products={yantraProducts}
        headerText={siteText.yantra_section}
      />
    ),

    bracelets: (
      <BraceletsSection
        key="bracelets"
        products={braceletsProducts}
        headerText={siteText.bracelets_section}
      />
    ),

    puja_samagri: (
      <PujaSamagriSection
        key="puja_samagri"
        products={pujaSamagriProducts}
        headerText={siteText.puja_samagri_section}
      />
    ),

    ads_banner: (
      <AdBannerSection
        key="ads_banner"
        position="home_mid"
      />
    ),

    video: (
      <VideoSection
        key="video"
        sectionText={siteText.video_section}
      />
    ),

    why: (
      <WhySection
        key="why"
        sectionText={siteText.why_section}
      />
    ),

    about: (
      <AboutSection
        key="about"
        guruji={guruji}
      />
    ),

    testimonials: (
      <TestimonialsSection
        key="testimonials"
        testimonials={testimonials}
        headerText={siteText.testimonials_section}
      />
    ),

    blog: (
      <BlogSection
        key="blog"
        articles={articles}
        headerText={siteText.blog_section}
      />
    ),
  };

  const DEFAULT_SEQUENCE = [
    'categories',
    'featured',
    'puja',
    'jyotish',
    'rudraksha',
    'ratna',
    'yantra',
    'bracelets',
    'puja_samagri',
    'ads_banner',
    'video',
    'why',
    'about',
    'testimonials',
    'blog',
  ];

  // -----------------------------------------------------------
  // Homepage render.
  // -----------------------------------------------------------

  return (
    <>
      <TopBar
        banners={topbarBanners}
        contactLink={topbarContactLink}
        contactText={topbarContactText}
      />

      <Navbar logo={logoUrl} />

      <PromoRibbon banner={promoBanner} />

      <main>
        <Hero
          banner={heroBanner}
          bgImage={heroBgUrl}
          bgSlides={dynamicHeroSlides}
          secBtn={siteText.hero_section}
        />

        <div
          className="post-hero"
          style={
            siteBgUrl
              ? {
                  backgroundImage:
                    `radial-gradient(ellipse at center, rgba(16,12,8,0.88), rgba(16,12,8,0.98)), url(${siteBgUrl})`,
                  backgroundAttachment: 'fixed',
                  backgroundSize: 'cover',
                }
              : undefined
          }
        >
          {sectionsData.length > 0
            ? sectionsData
                .filter((section) => section.enabled !== false)
                .map(
                  (section) =>
                    SECTION_COMPONENTS[section.key] || null
                )
            : DEFAULT_SEQUENCE.map(
                (key) => SECTION_COMPONENTS[key] || null
              )}
        </div>
      </main>

      <Footer
        logo={logoUrl}
        footerText={siteText.footer_section}
      />

      <WhatsAppFloat />

      <ScrollToTop />
    </>
  );
}
