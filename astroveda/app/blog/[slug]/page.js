import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getArticleDetail, getArticles, getSiteText } from '@/lib/api';
import { ARTICLES_CATALOG, getArticleBySlug } from '@/config/articles';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import ScrollToTop from '@/components/ScrollToTop';

export const dynamic = 'force-dynamic';

async function resolveArticle(slug) {
  if (!slug) return null;

  try {
    const res = await getArticleDetail(slug);
    if (res && res.slug) {
      const fallback = getArticleBySlug(slug) || {};
      return {
        ...fallback,
        ...res,
        fullArticleParagraphs: fallback.fullArticleParagraphs || (res.content ? [res.content] : []),
        relatedCategorySlug: fallback.relatedCategorySlug || 'rudraksha',
        relatedCategoryName: fallback.relatedCategoryName || 'Shop Collections',
        relatedServiceSlug: fallback.relatedServiceSlug || 'rudrabhishek',
        relatedServiceName: fallback.relatedServiceName || 'Spiritual Services',
      };
    }
  } catch {
    // If backend endpoint is unavailable, use catalog
  }

  return getArticleBySlug(slug);
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';

  if (!slug) return { title: 'Spiritual Wisdom | Swami Guruji' };

  const article = await resolveArticle(slug);

  if (!article) {
    return {
      title: 'Article Not Found | Swami Guruji',
      robots: { index: false, follow: false },
    };
  }

  const title = `${article.title} — Vedic Wisdom & Knowledge | Swami Guruji`;
  const desc = article.excerpt || `${article.title} - Authentic Vedic guidance and spiritual insights by Swami Guruji.`;
  const canonical = `${baseUrl}/blog/${article.slug}`;
  const coverImg = article.cover_image || article.coverImage || '/Five-Mukhi Rudraksha in Golden Light-1.png';

  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      type: 'article',
      publishedTime: article.created_at || article.createdAt,
      modifiedTime: article.updated_at || article.updatedAt || article.created_at || article.createdAt,
      authors: [article.author_name || article.author || 'Nagesh Guruji Sansthan'],
      siteName: 'Swami Guruji',
      locale: 'mr_IN',
      images: [{ url: coverImg, alt: article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [coverImg],
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  };
}

export default async function BlogArticlePage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug) notFound();

  const [article, siteTextRes] = await Promise.all([
    resolveArticle(slug),
    getSiteText().catch(() => null),
  ]);

  if (!article) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';
  const siteText = siteTextRes || {};
  const logoUrl = siteText.logo_url || '/swami-guruji-logo-cropped.jpg';

  const coverImg = article.cover_image || article.coverImage || '/Five-Mukhi Rudraksha in Golden Light-1.png';
  const authorName = article.author_name || article.author || 'Nagesh Guruji Sansthan';
  const pubDate = article.created_at || article.createdAt || '2026-10-16';
  const readTime = article.time || article.readTime || '5 min read';
  const paragraphs = article.fullArticleParagraphs || (article.content ? [article.content] : []);
  const otherArticles = ARTICLES_CATALOG.filter(a => a.slug !== slug);

  // Schema.org Article JSON-LD
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/blog/${article.slug}`,
    },
    headline: article.title,
    description: article.excerpt,
    image: [`${baseUrl}${coverImg}`],
    datePublished: pubDate,
    dateModified: article.updated_at || article.updatedAt || pubDate,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Swami Guruji',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/swami-guruji-logo-clean.png`,
      },
    },
  };

  // Schema.org BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Knowledge Centre', item: `${baseUrl}/#blog` },
      { '@type': 'ListItem', position: 3, name: article.title, item: `${baseUrl}/blog/${article.slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
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

      <main className="blog-page-main">
        <div className="blog-page-container">
          {/* Breadcrumb Navigation */}
          <nav className="product-breadcrumb-bar" aria-label="Breadcrumb">
            <Link href="/" className="crumb-link">Home</Link>
            <span className="crumb-sep">/</span>
            <Link href="/#blog" className="crumb-link">Knowledge Centre</Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current" aria-current="page">{article.title}</span>
          </nav>

          {/* Article Header */}
          <header className="blog-article-header">
            <div className="blog-category-pill-wrap">
              <span className="blog-badge-pill">{article.category || 'Vedic Wisdom'}</span>
              <span className="blog-read-time">{readTime}</span>
            </div>
            <h1 className="blog-article-title-h1">{article.title}</h1>
            {article.englishTitle && (
              <p className="blog-subtitle-en">{article.englishTitle}</p>
            )}
            <div className="blog-author-meta-strip">
              <span className="meta-author">✍ By <strong>{authorName}</strong></span>
              <span className="meta-sep">•</span>
              <time dateTime={pubDate} className="meta-date">
                Published: {new Date(pubDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
            </div>
          </header>

          {/* Hero Image */}
          <div className="blog-hero-image-wrap">
            <Image
              src={coverImg}
              alt={article.title}
              width={800}
              height={450}
              className="blog-hero-image"
              priority
            />
          </div>

          {/* Article Body Content */}
          <article className="blog-article-body">
            <div className="blog-lead-box">
              <p className="blog-lead-para">{article.excerpt}</p>
            </div>

            <div className="blog-paragraphs">
              {paragraphs.map((p, idx) => (
                <p key={idx} className="blog-content-p">{p}</p>
              ))}
            </div>

            {/* Sacred Guidance Callout */}
            <div className="blog-sacred-blessing-box">
              <div className="blessing-icon">ॐ</div>
              <div className="blessing-text">
                <h4>शास्त्रोक्त मार्गदर्शन व संकल्प</h4>
                <p>
                  स्वामी गुरुजींच्या मार्गदर्शनाखाली सर्व आध्यात्मिक उत्पादने व पूजा विधी वैदिक परंपरेनुसार, शुद्धि-मंत्रोच्चारासह वाराणसी व त्र्यंबकेश्वर क्षेत्रातील तज्ज्ञ पुरोहितांकडून संपन्न केले जातात.
                </p>
              </div>
            </div>

            {/* Cross-linking to Collections and Services */}
            <div className="blog-cross-links-box">
              <h3>Related Vedic Offerings &amp; Consultations</h3>
              <p>Explore sanctified spiritual items and personalized Jyotish rituals related to this knowledge:</p>
              <div className="cross-links-grid">
                {article.relatedCategorySlug && (
                  <Link href={`/category/${article.relatedCategorySlug}`} className="cross-link-card">
                    <span className="cl-badge">Product Collection</span>
                    <strong>{article.relatedCategoryName || 'Explore Collection'} →</strong>
                    <span>100% authentic, lab certified and energized</span>
                  </Link>
                )}
                {article.relatedServiceSlug && (
                  <Link href={`/services/${article.relatedServiceSlug}`} className="cross-link-card">
                    <span className="cl-badge">Sacred Ritual / Seva</span>
                    <strong>{article.relatedServiceName || 'Book Puja Seva'} →</strong>
                    <span>Personalized sankalp with purohit guidance</span>
                  </Link>
                )}
                <Link href="/#jyotish" className="cross-link-card">
                  <span className="cl-badge">Jyotish Consult</span>
                  <strong>Kundali Analysis with Guruji →</strong>
                  <span>Accurate astrological predictions &amp; dosha remedies</span>
                </Link>
              </div>
            </div>
          </article>

          {/* Other Wisdom Articles */}
          {otherArticles.length > 0 && (
            <section className="blog-more-articles-sec">
              <h3 className="more-articles-heading">More Sacred Knowledge Articles</h3>
              <div className="more-articles-grid">
                {otherArticles.map(other => (
                  <Link key={other.slug} href={`/blog/${other.slug}`} className="more-article-card">
                    <div className="more-article-img-wrap">
                      <Image
                        src={other.coverImage}
                        alt={other.title}
                        width={240}
                        height={140}
                        className="more-article-img"
                      />
                    </div>
                    <div className="more-article-info">
                      <span className="more-article-cat">{other.category}</span>
                      <h4 className="more-article-title">{other.title}</h4>
                      <p className="more-article-excerpt">{other.excerpt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="blog-back-footer-nav">
            <Link href="/" className="btn btn-gold">
              ← Return to Swami Guruji Homepage
            </Link>
          </div>
        </div>
      </main>

      <Footer logo={logoUrl} footerText={siteText.footer_section} />
      <WhatsAppFloat />
      <ScrollToTop />
    </>
  );
}

