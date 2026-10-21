import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
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
import SpecialCollectionsSection from '@/components/SpecialCollectionsSection';
import VideoSection from '@/components/VideoSection';
import WhySection from '@/components/WhySection';
import AboutSection from '@/components/AboutSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import BlogSection from '@/components/BlogSection';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';

import {
  getProducts,
  getCategories,
  getPujaServices,
  getTestimonials,
  getArticles,
  getBanners,
  getGurujiProfile,
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
  ] = await Promise.all([
    getProducts().catch(() => null),
    getCategories().catch(() => null),
    getPujaServices().catch(() => null),
    getTestimonials().catch(() => null),
    getArticles().catch(() => null),
    getBanners().catch(() => null),
    getGurujiProfile().catch(() => null),
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
        s.includes('moonga')
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
  const heroBanner = allBanners.find(b => b.position === 'hero') || null;
  const topbarBanners = allBanners.filter(b => b.position === 'topbar');
  const promoBanner = allBanners.find(b => b.position === 'promo') || null;
  const logoBanner = allBanners.find(b => b.position === 'logo') || null;
  const bgBanner = allBanners.find(b => b.position === 'hero_bg' || b.position === 'bg_image') || null;

  const backendBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
  const resolveImg = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/static/')) return `${backendBase}${url}`;
    return url;
  };

  const logoUrl = resolveImg(logoBanner?.image_url) || '/swami-guruji-logo-cropped.jpg';
  const heroBgUrl = resolveImg(bgBanner?.image_url || heroBanner?.image_url);

  const categories = categoriesRes?.categories || [];
  const pujaServices = pujaRes?.puja_services || [];
  const testimonials = testimonialsRes?.testimonials || [];
  const articles = articlesRes?.articles || [];
  const guruji = gurujiRes?.guruji || gurujiRes || null;

  return (
    <>
      <TopBar banners={topbarBanners} />
      <Navbar logo={logoUrl} />
      {promoBanner && (
        <div style={{
          background: 'linear-gradient(90deg, #d4af37, #f69145, #d4af37)',
          color: '#1a1005',
          padding: '8px 16px',
          textAlign: 'center',
          fontWeight: 600,
          fontSize: '13px',
          letterSpacing: '0.02em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}>
          <span>✨ {promoBanner.title}</span>
          {promoBanner.subtitle && <span style={{ opacity: 0.9 }}>· {promoBanner.subtitle}</span>}
          {promoBanner.link_url && (
            <a href={promoBanner.link_url} style={{ color: '#1a1005', textDecoration: 'underline', fontWeight: 700 }}>
              {promoBanner.button_text || 'Shop Now →'}
            </a>
          )}
        </div>
      )}
      <main>
        <Hero banner={heroBanner} bgImage={heroBgUrl} />
        <div className="post-hero">
          <CategorySection categories={categories} />
          <FeaturedSection products={featuredProducts} />
          <PujaSection services={pujaServices} />
          <JyotishSection />
          <RudrakshaSection products={rudrakshaProducts} />
          <RatnaSection products={ratnaProducts} />
          <YantraSection products={yantraProducts} />
          <BraceletsSection products={braceletsProducts} />
          <PujaSamagriSection products={pujaSamagriProducts} />
          <SpecialCollectionsSection products={specialCollectionsProducts} />
          <VideoSection />
          <WhySection />
          <AboutSection guruji={guruji} />
          <TestimonialsSection testimonials={testimonials} />
          <BlogSection articles={articles} />
        </div>
      </main>
      <Footer logo={logoUrl} />
      <WhatsAppFloat />
    </>
  );
}
