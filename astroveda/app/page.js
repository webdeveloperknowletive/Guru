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
  // Fetch live database records across all modules in parallel with error shielding
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

  // Adapt raw API products into UI format and sort by display_rank ASC
  const rawProducts = productsRes?.products || [];
  const allProducts = rawProducts
    .map(adaptApiProduct)
    .filter(Boolean)
    .sort((a, b) => {
      const rankA = Number(a.display_rank ?? a.rank ?? 999);
      const rankB = Number(b.display_rank ?? b.rank ?? 999);
      if (rankA !== rankB) return rankA - rankB;
      return 0;
    });

  // Helper sort function for product slices
  const sortByRank = (arr) =>
    [...arr].sort((a, b) => {
      const rankA = Number(a.display_rank ?? a.rank ?? 999);
      const rankB = Number(b.display_rank ?? b.rank ?? 999);
      if (rankA !== rankB) return rankA - rankB;
      return 0;
    });

  // Group products by domain category
  const rudrakshaProducts = sortByRank(
    allProducts.filter(p => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();
      return s.includes('rudraksha') || s.includes('mukhi') || s.includes('mala');
    })
  );

  const ratnaProducts = sortByRank(
    allProducts.filter(p => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();
      if (s.includes('bracelet')) return false;
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

  const yantraProducts = sortByRank(
    allProducts.filter(p => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();
      return s.includes('yantra');
    })
  );

  const braceletsProducts = sortByRank(
    allProducts.filter(p => {
      const s = `${p.cat} ${p.title} ${p.catLabel}`.toLowerCase();
      return s.includes('bracelet');
    })
  );

  const pujaSamagriProducts = sortByRank(
    allProducts.filter(p => {
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

  const specialCollectionsProducts = sortByRank(
    allProducts.filter(p => {
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

  // Featured selection: products with hot badge or top 4
  const featuredCandidates = sortByRank(
    allProducts.filter(p => p.badge === 'hot' || p.badge === 'new' || p.badge === 'lab')
  );
  const featuredProducts = featuredCandidates.length >= 4 ? featuredCandidates.slice(0, 4) : allProducts.slice(0, 4);

  // Content records & Banners
  const allBanners = heroBannerRes?.banners || [];
  const heroBanners = allBanners.filter(b => b.position === 'hero');
  const heroBanner = heroBanners[0] || null;
  const topbarBanners = allBanners.filter(b => b.position === 'topbar');
  const promoBanner = allBanners.find(b => b.position === 'promo') || null;
  const logoBanner = allBanners.find(b => b.position === 'logo') || null;

  const backendBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
  const resolveImg = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/static/')) return `${backendBase}${url}`;
    return url;
  };

  // Collect all active hero background slides (hero_bg and hero banners with uploaded images)
  const bgBanners = allBanners.filter(b => b.position === 'hero_bg' || (b.position === 'hero' && b.image_url));
  const dynamicHeroSlides = bgBanners
    .map(b => resolveImg(b.image_url))
    .filter(Boolean);

  // Section / Site background image (bg_image)
  const siteBgBanner = allBanners.find(b => b.position === 'bg_image');
  const siteBgUrl = resolveImg(siteBgBanner?.image_url);

  const logoUrl = resolveImg(logoBanner?.image_url) || '/swami-guruji-logo-cropped.jpg';
  const heroBgUrl = dynamicHeroSlides[0] || null;

  const categories = categoriesRes?.categories || [];
  const pujaServices = pujaRes?.puja_services || [];
  const testimonials = testimonialsRes?.testimonials || [];
  const articles = articlesRes?.articles || [];
  const guruji = gurujiRes?.guruji || gurujiRes || null;
  const siteText = siteTextRes?.site_text || siteTextRes || {};

  const topbarContactLink = siteText?.hero_section?.whatsapp_url || siteText?.footer_section?.whatsapp_url || 'https://wa.me/919623117545';
  const topbarContactText = siteText?.hero_section?.contact_text || 'Talk to Guruji';

  // Dynamic sections configuration lookup
  const sectionsData = sectionsRes?.sections || [];
  const SECTION_COMPONENTS = {
    categories: <CategorySection key="categories" categories={categories} headerText={siteText.category_section} />,
    featured: <FeaturedSection key="featured" products={featuredProducts} headerText={siteText.featured_section} />,
    puja: <PujaSection key="puja" services={pujaServices} headerText={siteText.puja_section} />,
    jyotish: <JyotishSection key="jyotish" sectionText={siteText.jyotish_section} />,
    rudraksha: <RudrakshaSection key="rudraksha" products={rudrakshaProducts} headerText={siteText.rudraksha_section} />,
    ratna: <RatnaSection key="ratna" products={ratnaProducts} headerText={siteText.ratna_section} />,
    yantra: <YantraSection key="yantra" products={yantraProducts} headerText={siteText.yantra_section} />,
    bracelets: <BraceletsSection key="bracelets" products={braceletsProducts} headerText={siteText.bracelets_section} />,
    puja_samagri: <PujaSamagriSection key="puja_samagri" products={pujaSamagriProducts} headerText={siteText.puja_samagri_section} />,
    ads_banner: <AdBannerSection key="ads_banner" position="home_mid" />,
    video: <VideoSection key="video" sectionText={siteText.video_section} />,
    why: <WhySection key="why" sectionText={siteText.why_section} />,
    about: <AboutSection key="about" guruji={guruji} />,
    testimonials: <TestimonialsSection key="testimonials" testimonials={testimonials} headerText={siteText.testimonials_section} />,
    blog: <BlogSection key="blog" articles={articles} headerText={siteText.blog_section} />,
  };

  const DEFAULT_SEQUENCE = [
    'categories', 'featured', 'puja', 'jyotish', 'rudraksha',
    'ratna', 'yantra', 'bracelets', 'puja_samagri', 'ads_banner',
    'video', 'why', 'about', 'testimonials', 'blog',
  ];

  return (
    <>
      <TopBar banners={topbarBanners} contactLink={topbarContactLink} contactText={topbarContactText} />
      <Navbar logo={logoUrl} />
      <PromoRibbon banner={promoBanner} />
      <main>
        <Hero banner={heroBanner} bgImage={heroBgUrl} bgSlides={dynamicHeroSlides} secBtn={siteText.hero_section} />
        <div 
          className="post-hero"
          style={siteBgUrl ? {
            backgroundImage: `radial-gradient(ellipse at center, rgba(16,12,8,0.88), rgba(16,12,8,0.98)), url(${siteBgUrl})`,
            backgroundAttachment: 'fixed',
            backgroundSize: 'cover',
          } : undefined}
        >
          {sectionsData.length > 0
            ? sectionsData
                .filter(s => s.enabled !== false)
                .map(s => SECTION_COMPONENTS[s.key] || null)
            : DEFAULT_SEQUENCE.map(key => SECTION_COMPONENTS[key] || null)
          }
        </div>
      </main>
      <Footer logo={logoUrl} footerText={siteText.footer_section} />
      <WhatsAppFloat />
      <ScrollToTop />
    </>
  );
}
