import { getProducts, getCategories, getPujaServices, getArticles } from '@/lib/api';
import { getAllProducts } from '@/lib/products';
import { JYOTISH_SERVICES } from '@/config/jyotishServices';
import { ARTICLES_CATALOG } from '@/config/articles';

export const revalidate = 3600;

const FALLBACK_CATEGORIES = [
  'rudraksha',
  'ratna',
  'yantra',
  'bracelets',
  'puja-samagri',
];

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swamiguruji.com';

  const urls = [
    // 1. Homepage
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  // 2. Categories
  const categorySlugs = new Set();
  try {
    const catRes = await getCategories();
    const categories = catRes?.categories || [];
    for (const c of categories) {
      if (c.slug && c.is_active !== false) {
        categorySlugs.add(c.slug);
      }
    }
  } catch {
    // backend offline fallback
  }

  // Ensure standard active categories are represented
  for (const slug of FALLBACK_CATEGORIES) {
    categorySlugs.add(slug);
  }

  for (const slug of categorySlugs) {
    urls.push({
      url: `${baseUrl}/category/${encodeURIComponent(slug)}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    });
  }

  // 3. Products
  const seenProductSlugs = new Set();
  try {
    const res = await getProducts();
    const products = res?.products || [];
    for (const p of products) {
      if (p.slug && !seenProductSlugs.has(p.slug) && p.publishing_status !== 'archived' && p.publishing_status !== 'draft') {
        seenProductSlugs.add(p.slug);
        urls.push({
          url: `${baseUrl}/product/${encodeURIComponent(p.slug)}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
  } catch {
    // fallback if API is unreachable
  }

  if (seenProductSlugs.size === 0) {
    try {
      const fallbackProducts = getAllProducts();
      for (const p of fallbackProducts) {
        if (p.slug && !seenProductSlugs.has(p.slug)) {
          seenProductSlugs.add(p.slug);
          urls.push({
            url: `${baseUrl}/product/${encodeURIComponent(p.slug)}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
          });
        }
      }
    } catch {}
  }

  // 4. Spiritual & Jyotish Services
  const seenServiceSlugs = new Set();
  try {
    const pujaRes = await getPujaServices();
    const pujaServices = pujaRes?.puja_services || [];
    for (const s of pujaServices) {
      if (s.slug && s.is_active !== false && !seenServiceSlugs.has(s.slug)) {
        seenServiceSlugs.add(s.slug);
        urls.push({
          url: `${baseUrl}/services/${encodeURIComponent(s.slug)}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
  } catch {
    // API offline fallback
  }

  // Also include Jyotish consultation service pages
  for (const js of JYOTISH_SERVICES) {
    if (js.id && !seenServiceSlugs.has(js.id)) {
      seenServiceSlugs.add(js.id);
      urls.push({
        url: `${baseUrl}/services/${encodeURIComponent(js.id)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  }

  // 5. Blog & Knowledge Wisdom Articles
  const seenArticleSlugs = new Set();
  try {
    const artRes = await getArticles();
    const articles = artRes?.articles || [];
    for (const a of articles) {
      if (a.slug && !seenArticleSlugs.has(a.slug)) {
        seenArticleSlugs.add(a.slug);
        urls.push({
          url: `${baseUrl}/blog/${encodeURIComponent(a.slug)}`,
          lastModified: a.created_at ? new Date(a.created_at) : new Date(),
          changeFrequency: 'monthly',
          priority: 0.7,
        });
      }
    }
  } catch {
    // API offline fallback
  }

  for (const a of ARTICLES_CATALOG) {
    if (a.slug && !seenArticleSlugs.has(a.slug)) {
      seenArticleSlugs.add(a.slug);
      urls.push({
        url: `${baseUrl}/blog/${encodeURIComponent(a.slug)}`,
        lastModified: a.updatedAt ? new Date(a.updatedAt) : new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  }

  return urls;
}
