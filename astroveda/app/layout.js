import './globals.css';
import { StoreProvider } from '@/context/StoreContext';
import CartPanel from '@/components/CartPanel';
import WishlistPanel from '@/components/WishlistPanel';
import SearchOverlay from '@/components/SearchOverlay';
import MobileDrawer from '@/components/MobileDrawer';
import ProductModal from '@/components/ProductModal';
import CheckoutModal from '@/components/CheckoutModal';
import OrderTrackingModal from '@/components/OrderTrackingModal';
import ContactModal from '@/components/ContactModal';
import ArticleModal from '@/components/ArticleModal';
import WelcomeOfferModal from '@/components/WelcomeOfferModal';
import Toast from '@/components/Toast';
import UrgencyNotification from '@/components/UrgencyNotification';
import CookieConsentModal from '@/components/CookieConsentModal';
import ScrollReveal from '@/components/ScrollReveal';
import AnalyticsTracker from '@/components/AnalyticsTracker';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Swami Guruji — परंपरेतून मार्गदर्शन • श्रद्धेतून समाधान',
  description: 'Authentic Rudraksha, Gemstones, Yantra, Bracelets and Jyotish Consultation. 25+ years experience. Certified, energised and delivered across India.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'mr_IN',
    alternateLocale: ['hi_IN', 'en_IN'],
    url: '/',
    siteName: 'Swami Guruji',
    title: 'Swami Guruji — परंपरेतून मार्गदर्शन • श्रद्धेतून समाधान',
    description: 'Authentic Rudraksha, Gemstones, Yantra, Bracelets and Jyotish Consultation. 25+ years experience. Certified, energised and delivered across India.',
    images: [
      {
        url: '/swami-guruji-logo-clean.png',
        width: 800,
        height: 600,
        alt: 'Swami Guruji — Sacred Spiritual Products & Vedic Jyotish Seva',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Swami Guruji — परंपरेतून मार्गदर्शन • श्रद्धेतून समाधान',
    description: 'Authentic Rudraksha, Gemstones, Yantra, Bracelets and Jyotish Consultation. 25+ years experience. Certified, energised and delivered across India.',
    images: ['/swami-guruji-logo-clean.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export default function RootLayout({ children }) {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Swami Guruji',
    url: siteUrl,
    logo: `${siteUrl}/swami-guruji-logo-clean.png`,
    description: 'Authentic Rudraksha, Gemstones, Yantra, Bracelets and Jyotish Consultation. 25+ years experience. Certified, energised and delivered across India.',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-9623117545',
      contactType: 'customer support',
      availableLanguage: ['Marathi', 'Hindi', 'English'],
    },
  };

  const webSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Swami Guruji',
    url: siteUrl,
    inLanguage: ['mr', 'hi', 'en'],
  };

  return (
    <html lang="mr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800&family=Tiro+Devanagari+Sanskrit:ital@0;1&family=Outfit:wght@200;300;400;500;600;700;800&family=Mukta:wght@300;400;500;600;700;800&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
      </head>
      <body>
        <StoreProvider>
          <AnalyticsTracker />
          <div className="bg-fx" />
          <div className="bg-grain" />
          <ScrollReveal />
          {children}
          <CartPanel />
          <WishlistPanel />
          <SearchOverlay />
          <MobileDrawer />
          <ProductModal />
          <CheckoutModal />
          <OrderTrackingModal />
          <ContactModal />
          <ArticleModal />
          <WelcomeOfferModal />
          <Toast />
          <UrgencyNotification />
          <CookieConsentModal />
        </StoreProvider>
      </body>
    </html>
  );
}
