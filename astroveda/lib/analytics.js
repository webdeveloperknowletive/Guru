/**
 * Storefront Analytics & Live Telemetry Client for AstroVeda
 * Handles visitor identification, session management, foreground engagement timing,
 * and reliable beacon transport.
 */

const VISITOR_COOKIE_NAME = 'av_vid';
const SESSION_STORAGE_KEY = 'av_sid';
const SESSION_TIMESTAMP_KEY = 'av_sid_ts';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity

// Fallback UUID-like generator
function generateId(prefix = 'av') {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

/**
 * Get or create persistent Visitor ID (stored across localStorage & cookie)
 */
export function getVisitorId() {
  if (typeof window === 'undefined') return 'server_render';

  try {
    let vid = localStorage.getItem('av_visitor_id');
    if (!vid) {
      // Check cookie
      const match = document.cookie.match(new RegExp('(^| )' + VISITOR_COOKIE_NAME + '=([^;]+)'));
      if (match) vid = match[2];
    }

    if (!vid) {
      vid = generateId('av_vid');
    }

    // Persist
    localStorage.setItem('av_visitor_id', vid);
    document.cookie = `${VISITOR_COOKIE_NAME}=${vid}; path=/; max-age=31536000; SameSite=Lax`;
    return vid;
  } catch {
    return generateId('av_vid');
  }
}

/**
 * Get or create Session ID (renewed after 30 min of inactivity)
 */
export function getSessionId() {
  if (typeof window === 'undefined') return 'server_session';

  try {
    const now = Date.now();
    let sid = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const lastActive = parseInt(sessionStorage.getItem(SESSION_TIMESTAMP_KEY) || '0', 10);

    if (!sid || now - lastActive > SESSION_TIMEOUT_MS) {
      sid = generateId('av_sid');
      sessionStorage.setItem(SESSION_STORAGE_KEY, sid);
    }

    sessionStorage.setItem(SESSION_TIMESTAMP_KEY, now.toString());
    return sid;
  } catch {
    return generateId('av_sid');
  }
}

/**
 * Detect client device classification
 */
export function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return { type: 'desktop', browser: 'Unknown', os: 'Unknown' };
  }

  const ua = navigator.userAgent || '';
  let type = 'desktop';
  if (/mobile|android|iphone|ipod/i.test(ua)) {
    type = 'mobile';
  } else if (/ipad|tablet/i.test(ua) || (navigator.maxTouchPoints > 1 && !/iphone/i.test(ua))) {
    type = 'tablet';
  }

  let browser = 'Unknown';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  return { type, browser, os };
}

// In-memory queue of pending telemetry events
let eventQueue = [];
let flushTimeout = null;

/**
 * Enqueue an analytics event to be flushed
 */
export function recordEvent(eventData) {
  if (typeof window === 'undefined') return;

  eventQueue.push({
    ...eventData,
    timestamp: new Date().toISOString(),
  });

  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushEventQueue();
    }, 2500); // Debounce batch send
  }
}

/**
 * Flush all enqueued events to backend
 */
export function flushEventQueue(isUnloading = false) {
  if (typeof window === 'undefined' || eventQueue.length === 0) return;

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  const payload = {
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    path: window.location.pathname || '/',
    referrer: document.referrer || '',
    device: getDeviceInfo(),
    events: eventsToSend,
  };

  const endpoint = '/api/v1/analytics/track';

  if (isUnloading && navigator.sendBeacon) {
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    } catch (e) {
      // Fallback to fetch with keepalive below
    }
  }

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Non-blocking: fail gracefully without user interruption
  });
}

/**
 * Send lightweight foreground heartbeat
 */
export function sendHeartbeat(engagedDeltaSeconds = 0, currentPath = '/', currentSection = null) {
  if (typeof window === 'undefined') return;

  const payload = {
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    engaged_delta: engagedDeltaSeconds,
    current_path: currentPath,
    current_section: currentSection,
  };

  fetch('/api/v1/analytics/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
