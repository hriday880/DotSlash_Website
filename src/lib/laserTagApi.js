// Client for the laser tag booking API (server/). The browser never touches
// the bookings database directly — prices, seats and promo codes are decided there.
const API = (import.meta.env.VITE_LASER_API_URL || 'http://localhost:8787').replace(/\/+$/, '');

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw Object.assign(new Error('Can’t reach the booking server. Check your connection and try again.'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
  return data;
}

export const laserTagApi = {
  getEvent: () => request('/api/event'),
  checkPromo: (code, mode) => request('/api/promo/check', { method: 'POST', body: { code, mode } }),
  createBooking: payload => request('/api/bookings', { method: 'POST', body: payload }),
  getBooking: id => request(`/api/bookings/${encodeURIComponent(id)}`),
  submitPayment: (id, utr, screenshot) =>
    request(`/api/bookings/${encodeURIComponent(id)}/payment`, { method: 'POST', body: { utr, screenshot } }),
  lookup: (ref, email) => request('/api/lookup', { method: 'POST', body: { ref, email } }),
  adminLogin: password => request('/api/admin/login', { method: 'POST', body: { password } }),
  adminOverview: token => request('/api/admin/overview', { token }),
  adminProof: (token, bookingId) => request(`/api/admin/proof/${encodeURIComponent(bookingId)}`, { token }),
  adminReview: (token, bookingId, action, reason) =>
    request('/api/admin/review', { method: 'POST', body: { bookingId, action, reason }, token }),
  adminCheckin: (token, bookingId, undo = false) =>
    request('/api/admin/checkin', { method: 'POST', body: { bookingId, undo }, token })
};

export const SUPPORT = {
  instagram: '@dotslashflame',
  instagramUrl: 'https://www.instagram.com/dotslashflame',
  email: 'dotslash@flame.edu.in'
};

/** Shrink a payment screenshot to a JPEG data URL small enough to upload quickly. */
export async function compressScreenshot(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file isn’t an image we can read. Try a PNG or JPG screenshot.'));
      el.src = url;
    });
    for (const [maxSide, quality] of [[1400, 0.75], [1100, 0.6], [900, 0.5]]) {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length < 1_000_000) return data;
    }
    throw new Error('Screenshot is too large. Crop it and try again.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function safeStorage(kind = 'local') {
  const store = () => (kind === 'session' ? window.sessionStorage : window.localStorage);
  return {
    get(k) { try { return store().getItem(k); } catch { return null; } },
    set(k, v) { try { store().setItem(k, v); } catch { /* private mode */ } },
    remove(k) { try { store().removeItem(k); } catch { /* private mode */ } }
  };
}
