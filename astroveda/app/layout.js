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
import ScrollReveal from '@/components/ScrollReveal';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata = {
  title: 'AstroVeda — परंपरेतून मार्गदर्शन • श्रद्धेतून समाधान',
  description: 'Authentic Rudraksha, Gemstones, Yantra, Bracelets and Jyotish Consultation. 25+ years experience. Certified, energised and delivered across India.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="mr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800&family=Tiro+Devanagari+Sanskrit:ital@0;1&family=Outfit:wght@200;300;400;500;600;700;800&family=Mukta:wght@300;400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <StoreProvider>
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
        </StoreProvider>
      </body>
    </html>
  );
}
