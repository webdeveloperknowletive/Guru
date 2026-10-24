/**
 * Central API Client for JAPAM Spiritual Commerce REST API
 * Handles base URL configuration, timeouts, error normalization, and response serialization.
 */


const API_BASE_URL = (() => {
  // Browser requests go through Next.js rewrites.
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }

  // Server-side requests must use an absolute URL.
  const backend = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://backend:5000'
  )
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/, '');

  return `${backend}/api/v1`;
})();


const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Custom error class carrying HTTP status and server error payload
 */
export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Universal request wrapper with timeout and JSON handling
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    ...options.headers,
  };

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const errMsg = (data && typeof data === 'object' && (data.error || data.message))
        ? (data.error || data.message)
        : `Request failed with status ${res.status}`;
      throw new ApiError(errMsg, res.status, data);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your internet connection.', 408);
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'Network error connecting to spiritual commerce API', 503);
  }
}

/* ==================== API ENDPOINTS ==================== */

/**
 * GET /api/v1/catalog/products
 */
export async function getProducts(categorySlug = null) {
  const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : '';
  return request(`/catalog/products${query}`, { method: 'GET' });
}

/**
 * POST /api/products or /api/v1/catalog/products
 */
export async function createProduct(productData) {
  return request('/catalog/products', {
    method: 'POST',
    body: JSON.stringify(productData),
  });
}

/**
 * PUT/PATCH /api/products/:id or /api/v1/catalog/products/:id
 */
export async function updateProduct(productId, productData) {
  return request(`/catalog/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    body: JSON.stringify(productData),
  });
}

/**
 * DELETE /api/products/:id or /api/v1/catalog/products/:id
 */
export async function deleteProduct(productId) {
  return request(`/catalog/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  });
}

/**
 * GET /api/v1/catalog/products/<slug>
 */
export async function getProductDetail(slug) {
  return request(`/catalog/products/${encodeURIComponent(slug)}`, { method: 'GET' });
}

/**
 * GET /api/v1/catalog/categories
 */
export async function getCategories() {
  return request('/catalog/categories', { method: 'GET' });
}

/**
 * GET /api/v1/services/puja
 */
export async function getPujaServices() {
  return request('/services/puja', { method: 'GET' });
}

/**
 * POST /api/v1/services/book-puja
 */
export async function bookPuja(bookingData) {
  return request('/services/book-puja', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });
}

/**
 * POST /api/v1/services/request-consultation
 */
export async function requestConsultation(consultationData) {
  return request('/services/request-consultation', {
    method: 'POST',
    body: JSON.stringify(consultationData),
  });
}

/**
 * POST /api/v1/cart/calculate
 */
export async function calculateCart(items, couponCode = '') {
  return request('/cart/calculate', {
    method: 'POST',
    body: JSON.stringify({
      items,
      coupon_code: couponCode,
    }),
  });
}

/**
 * POST /api/v1/orders/checkout
 */
export async function checkoutOrder(orderData, idempotencyKey = '') {
  const headers = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return request('/orders/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...orderData,
      idempotency_key: idempotencyKey,
    }),
  });
}

/**
 * GET /api/v1/orders/<order_number>
 */
export async function getOrderTracking(orderNumber, token = '', email = '') {
  const headers = {};
  if (token) {
    headers['X-Order-Token'] = token;
  }
  if (email) {
    headers['X-Customer-Email'] = email;
  }
  const query = token ? `?token=${encodeURIComponent(token)}` : (email ? `?email=${encodeURIComponent(email)}` : '');
  return request(`/orders/${encodeURIComponent(orderNumber)}${query}`, {
    method: 'GET',
    headers,
  });
}

/**
 * POST /api/v1/orders/<order_number>/cancel
 */
export async function cancelOrder(orderNumber, token = '', email = '') {
  return request(`/orders/${encodeURIComponent(orderNumber)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      token,
      email,
    }),
  });
}

/**
 * POST /api/v1/orders/<order_number>/return
 */
export async function returnOrder(orderNumber, reason, token = '', email = '') {
  return request(`/orders/${encodeURIComponent(orderNumber)}/return`, {
    method: 'POST',
    body: JSON.stringify({
      reason,
      token,
      email,
    }),
  });
}

/**
 * POST /api/v1/contact
 */
export async function submitContact(contactData) {
  return request('/contact', {
    method: 'POST',
    body: JSON.stringify(contactData),
  });
}

/**
 * GET /api/v1/content/testimonials
 */
export async function getTestimonials() {
  return request('/content/testimonials', { method: 'GET' });
}

/**
 * GET /api/v1/content/articles
 */
export async function getArticles() {
  return request('/content/articles', { method: 'GET' });
}

/**
 * GET /api/v1/content/articles/<slug>
 */
export async function getArticleDetail(slug) {
  return request(`/content/articles/${encodeURIComponent(slug)}`, { method: 'GET' });
}

/**
 * GET /api/v1/content/banners
 */
export async function getBanners(position = null) {
  const query = position ? `?position=${encodeURIComponent(position)}` : '';
  return request(`/content/banners${query}`, { method: 'GET' });
}

/**
 * GET /api/v1/content/guruji
 */
export async function getGurujiProfile() {
  return request('/content/guruji', { method: 'GET' });
}

/**
 * GET /api/v1/services/consultations
 */
export async function getConsultations() {
  return request('/services/consultations', { method: 'GET' });
}

/**
 * POST /api/v1/catalog/products/<slug>/reviews
 */
export async function submitProductReview(slug, reviewData) {
  return request(`/catalog/products/${encodeURIComponent(slug)}/reviews`, {
    method: 'POST',
    body: JSON.stringify(reviewData),
  });
}

export async function getWelcomePopup(isPreview = false) {
  const query = isPreview ? '?preview=true' : '';
  return request(`/welcome-popup${query}`);
}

export async function getSiteText() {
  return request('/content/site-text', { method: 'GET' });
}

/**
 * GET /api/v1/content/ads?position=...
 */
export async function getAds(position = '') {
  const qs = position ? `?position=${encodeURIComponent(position)}` : '';
  return request(`/content/ads${qs}`, { method: 'GET' });
}

/**
 * GET /api/v1/content/sections
 */
export async function getSections() {
  return request('/content/sections', { method: 'GET' });
}

/**
 * GET /api/v1/services/availability?service_type=...&date=...
 */
export async function getAvailabilitySlots(serviceType = null, date = null) {
  const params = new URLSearchParams();
  if (serviceType) params.append('service_type', serviceType);
  if (date) params.append('date', date);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request(`/services/availability${qs}`, { method: 'GET' });
}


const api = {
  getProducts,
  getProductDetail,
  submitProductReview,
  getCategories,
  getPujaServices,
  getAvailabilitySlots,
  bookPuja,
  requestConsultation,
  calculateCart,
  checkoutOrder,
  getOrderTracking,
  cancelOrder,
  returnOrder,
  submitContact,
  getTestimonials,
  getArticles,
  getArticleDetail,
  getBanners,
  getGurujiProfile,
  getConsultations,
  getWelcomePopup,
  getSiteText,
  getAds,
  getSections,
};

export default api;


