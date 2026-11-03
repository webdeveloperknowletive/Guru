import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPujaServices, getSiteText } from '@/lib/api';
import { JYOTISH_SERVICES } from '@/config/jyotishServices';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import ScrollToTop from '@/components/ScrollToTop';
import ServiceBookingClient from '@/components/ServiceBookingClient';

export const dynamic = 'force-dynamic';

function findService(slug, pujaServices = []) {
  const puja = pujaServices.find(s => s.slug === slug && s.is_active !== false);
  if (puja) return { ...puja, isPuja: true };

  const jyotish = JYOTISH_SERVICES.find(s => s.id === slug || s.slug === slug);
  if (jyotish) {
    const defaultPkg = jyotish.packages?.[0];
    return {
      id: jyotish.id,
      slug: jyotish.id,
      name: jyotish.title,
      marathiTitle: jyotish.marathiTitle,
      description: jyotish.tagline,
      price: defaultPkg?.price || 101,
      isPuja: false,
      packages: jyotish.packages,
      inclusions: defaultPkg?.inclusions || ['Personalized Kundali Consultation', 'Planetary Analysis', 'Remedies Guidance'],
    };
  }

  return null;
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';

  if (!slug) return { title: 'Spiritual Services | Swami Guruji' };

  try {
    const res = await getPujaServices().catch(() => null);
    const service = findService(slug, res?.puja_services || []);

    if (!service) {
      return {
        title: 'Service Not Found | Swami Guruji',
        robots: { index: false, follow: false },
      };
    }

    const title = `${service.name || service.title} — Vedic Ritual & Guidance | Swami Guruji`;
    const desc = service.description || `Participate in traditional ${service.name} performed by qualified Vedic purohits with personalized sankalp and prasad dispatch across India.`;
    const canonical = `${baseUrl}/services/${slug}`;

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
        images: [{ url: service.image_url || '/guruji-consultation.jpg', alt: service.name }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: desc,
        images: [service.image_url || '/guruji-consultation.jpg'],
      },
      robots: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    };
  } catch {
    return { title: 'Spiritual Service | Swami Guruji' };
  }
}

export default async function ServicePage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug) notFound();

  const [pujaRes, siteTextRes] = await Promise.all([
    getPujaServices().catch(() => null),
    getSiteText().catch(() => null),
  ]);

  const service = findService(slug, pujaRes?.puja_services || []);
  if (!service) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';
  const siteText = siteTextRes || {};
  const logoUrl = siteText.logo_url || '/swami-guruji-logo-cropped.jpg';

  const inclusions = service.inclusions || [
    'Traditional Vedic Sankalp in your Gotra & Name',
    'Complete Hawan Samagri & Pure Cow Ghee',
    'Sacred Abhimantrit Prasad Dispatch Across India',
    'Live Video Streaming / Photo Darshan Link',
  ];

  const serviceFaqs = [
    {
      q: 'How does the online live sankalp work for outstation devotees?',
      a: 'The ritual is performed live in the sacred ashram. Before the puja begins, Guruji connects with you via video call or phone to recite your personalized Sankalp with your name, gotra, and birth nakshatra.',
    },
    {
      q: 'Will the sacred prasad and yantra be dispatched to our address?',
      a: 'Yes. Following the conclusion of the ritual, the sanctified prasad, sacred raksha sutra, and blessed articles are packed securely with Gangajal and dispatched via insured courier across India.',
    },
    {
      q: 'What information do I need to provide for the ritual?',
      a: 'You will need to provide the full names of the family members, your Gotra (if known; otherwise Kashyapa gotra is traditionally applied), birth star (nakshatra), and your current city or address.',
    },
  ];

  // Schema.org Service JSON-LD
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name || service.title,
    description: service.description,
    provider: {
      '@type': 'Organization',
      name: 'Swami Guruji',
      url: baseUrl,
    },
    offers: {
      '@type': 'Offer',
      price: service.price,
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: `${baseUrl}/services/${slug}`,
    },
    serviceType: service.isPuja ? 'Vedic Puja Ritual' : 'Vedic Astrology Consultation',
  };

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${baseUrl}/#puja` },
      { '@type': 'ListItem', position: 3, name: service.name || service.title, item: `${baseUrl}/services/${slug}` },
    ],
  };

  // FAQPage JSON-LD
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: serviceFaqs.map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <TopBar
        contactLink={siteText.topbar_contact_link || '#contact'}
        contactText={siteText.topbar_contact_text || 'Contact Guruji Seva'}
      />

      <Navbar logo={logoUrl} />

      <main className="service-page-main">
        <div className="service-page-container">
          {/* Breadcrumb Navigation */}
          <nav className="product-breadcrumb-bar" aria-label="Breadcrumb">
            <Link href="/" className="crumb-link">Home</Link>
            <span className="crumb-sep">/</span>
            <Link href="/#puja" className="crumb-link">Spiritual Services</Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current" aria-current="page">{service.name || service.title}</span>
          </nav>

          <div className="service-content-card">
            <div className="service-header-area">
              <span className="service-kicker">
                {service.isPuja ? 'Vedic Puja Ritual · Trimbakeshwar / Varanasi Tradition' : 'Vedic Jyotish Consultation'}
              </span>
              <h1 className="service-title-h1">{service.name || service.title}</h1>
              {service.marathiTitle && (
                <p className="service-marathi-subtitle">{service.marathiTitle}</p>
              )}
              <p className="service-lead-p">{service.description}</p>
            </div>

            {/* Quick Specs Pill Strip */}
            <div className="service-specs-strip">
              {service.deity && (
                <div className="spec-item">
                  <span className="spec-label">Deity / Aradhya:</span>
                  <strong className="spec-val">🪔 {service.deity}</strong>
                </div>
              )}
              {service.duration_minutes && (
                <div className="spec-item">
                  <span className="spec-label">Duration:</span>
                  <strong className="spec-val">⏳ ~{service.duration_minutes} Mins</strong>
                </div>
              )}
              <div className="spec-item">
                <span className="spec-label">Participation:</span>
                <strong className="spec-val">📡 Online Live Sankalp &amp; Offline Ashram</strong>
              </div>
            </div>

            {/* Inclusions & Booking CTA */}
            <div className="service-booking-grid">
              <div className="service-inclusions-col">
                <h3 className="inclusions-heading">Sacred Inclusions &amp; Vidhi Samagri</h3>
                <ul className="inclusions-list">
                  {inclusions.map((item, idx) => (
                    <li key={idx}>
                      <span className="check-bullet">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="service-cta-col">
                <ServiceBookingClient service={service} isPuja={service.isPuja} />
              </div>
            </div>

            {/* Genuine Visible FAQs */}
            <section className="service-faqs-section">
              <h3>Frequently Asked Questions</h3>
              <div className="service-faq-grid">
                {serviceFaqs.map((faq, idx) => (
                  <div key={idx} className="service-faq-card">
                    <h4>{faq.q}</h4>
                    <p>{faq.a}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer logo={logoUrl} footerText={siteText.footer_section} />
      <WhatsAppFloat />
      <ScrollToTop />
    </>
  );
}

