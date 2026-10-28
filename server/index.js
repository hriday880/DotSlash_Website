// DotSlash × Glitch Laser Tag booking API.
// Owns seat inventory, pricing, promo codes and payment approval so the
// browser can't fake any of them. Payments are plain UPI: the player submits
// their UTR + a screenshot and an admin approves it after checking the bank credit.
//
// The tables live in the shared `dotslash` DB, whose token is public (it ships
// in the website bundle). Every booking row is therefore HMAC-signed here and
// any row that fails verification is treated as if it didn't exist.
import http from 'node:http';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createDb } from './db.js';
import {
  EVENT, MODES, SLOTS, HOLD_MINUTES,
  getSlot, assignTeam, slotAvailability, price, normalizeCode, parseBookingRequest
} from './event.js';

const env = process.env;
const PORT = Number(env.PORT || 8787);
const UPI_ID = env.UPI_ID || '';
const UPI_NAME = env.UPI_NAME || 'DotSlash';
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || '';
const SIGNING_SECRET = env.SIGNING_SECRET || '';
const PROMO_CODES = new Set(String(env.PROMO_CODES || '').split(',').map(normalizeCode).filter(Boolean));
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);
const BOOKINGS_OPEN = env.BOOKINGS_OPEN !== 'false';
const MAX_SCREENSHOT_CHARS = 1_200_000; // ~900 KB image; the page compresses well below this
const MAX_BODY_BYTES = 1_400_000;

if (SIGNING_SECRET.length < 32) {
  throw new Error('SIGNING_SECRET must be set (32+ chars). Changing it later invalidates every booking.');
}

const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);

// ── helpers ──────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// All writes run one at a time (single Render instance), so read-check-write is safe.
let lockChain = Promise.resolve();
function locked(fn) {
  const run = lockChain.then(fn, fn);
  lockChain = run.catch(() => {});
  return run;
}

const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomId(len) {
  return Array.from(crypto.randomBytes(len), b => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

const rateBuckets = new Map();
function rateLimit(req, key, max, windowMs = 60_000) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const hits = (rateBuckets.get(bucketKey) || []).filter(t => now - t < windowMs);
  if (hits.length >= max) throw new HttpError(429, 'Too many attempts. Please wait a minute and try again.');
  hits.push(now);
  rateBuckets.set(bucketKey, hits);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, hits] of rateBuckets) if (hits.every(t => now - t > 600_000)) rateBuckets.delete(k);
}, 600_000).unref();

function maskEmail(e) {
  const [u, d] = String(e).split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`;
}

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (purpose, s) => crypto.createHmac('sha256', SIGNING_SECRET).update(`${purpose}:${s}`).digest('hex');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ── signed booking rows ──────────────────────────────────────────────────

const COLS = [
  'id', 'slot', 'team', 'mode', 'seats', 'squad_name', 'lead_name', 'lead_email', 'lead_phone',
  'players_json', 'base_amount', 'discount', 'amount', 'promo_code', 'status', 'hold_expires_at',
  'utr', 'utr_submitted_at', 'proof_hash', 'reviewed_at', 'created_at', 'checked_in_at', 'note'
];

const signRow = row => hmac('booking', JSON.stringify(COLS.map(c => row[c] ?? null)));

const tamperedSeen = new Set();
function verified(rows) {
  const good = [];
  for (const r of rows) {
    if (r.sig && safeEqual(r.sig, signRow(r))) good.push(r);
    else if (!tamperedSeen.has(r.id)) {
      tamperedSeen.add(r.id);
      console.warn(`[tamper] ignoring lt_bookings row ${r.id} — signature invalid`);
    }
  }
  return good;
}

async function saveBooking(row) {
  const full = Object.fromEntries(COLS.map(c => [c, row[c] ?? null]));
  full.sig = signRow(full);
  const cols = [...COLS, 'sig'];
  await db.execute(
    `INSERT OR REPLACE INTO lt_bookings (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map(c => full[c])
  );
  return full;
}

async function getBooking(id) {
  const { rows } = await db.execute('SELECT * FROM lt_bookings WHERE id = ?', [String(id).toUpperCase()]);
  return verified(rows)[0] || null;
}

const isLive = (b, now = Date.now()) =>
  b.status === 'PENDING' || b.status === 'PAID' || (b.status === 'HOLD' && b.hold_expires_at >= now);

async function liveBookings() {
  const { rows } = await db.execute(
    `SELECT * FROM lt_bookings WHERE status IN ('HOLD', 'PENDING', 'PAID')`
  );
  const now = Date.now();
  return verified(rows).filter(b => isLive(b, now));
}

function bySlot(bookings) {
  const map = new Map(SLOTS.map(s => [s.number, []]));
  for (const b of bookings) map.get(b.slot)?.push(b);
  return map;
}

async function expireHolds() {
  await locked(async () => {
    const { rows } = await db.execute(`SELECT * FROM lt_bookings WHERE status = 'HOLD' AND hold_expires_at < ?`, [Date.now()]);
    for (const b of verified(rows)) await saveBooking({ ...b, status: 'EXPIRED' });
  });
}

function promoFree(code, live) {
  return PROMO_CODES.has(code) && !live.some(b => b.promo_code === code);
}

function upiLink(b) {
  const q = new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, am: b.amount.toFixed(2), cu: 'INR', tn: b.id });
  return `upi://pay?${q.toString().replace(/\+/g, '%20')}`;
}

function publicTicket(b) {
  const slot = getSlot(b.slot);
  const players = JSON.parse(b.players_json);
  return {
    id: b.id,
    status: b.status,
    slot: b.slot,
    slotLabel: slot.label,
    team: b.team,
    mode: b.mode,
    modeLabel: MODES[b.mode].label,
    squadName: b.squad_name,
    players: players.map((p, i) => ({ name: p.name, email: i === 0 ? maskEmail(p.email) : undefined })),
    baseAmount: b.base_amount,
    discount: b.discount,
    amount: b.amount,
    promoApplied: Boolean(b.promo_code),
    holdExpiresAt: b.status === 'HOLD' ? b.hold_expires_at : null,
    payment: b.status === 'HOLD' ? { upiId: UPI_ID, payee: UPI_NAME, amount: b.amount, note: b.id, link: upiLink(b) } : null,
    rejectionReason: b.status === 'REJECTED' ? b.note : null,
    checkedIn: Boolean(b.checked_in_at),
    event: { name: EVENT.name, date: EVENT.dateLabel, venue: EVENT.venue }
  };
}

// ── admin auth ───────────────────────────────────────────────────────────

function signAdminToken() {
  const exp = String(Date.now() + 12 * 60 * 60 * 1000);
  return `${exp}.${hmac('admin', exp)}`;
}

function requireAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now() || !safeEqual(sig, hmac('admin', exp))) {
    throw new HttpError(401, 'Please log in again.');
  }
}

// ── routes ───────────────────────────────────────────────────────────────

const routes = {
  'GET /health': async () => ({ ok: true }),

  'GET /api/event': async () => {
    const slotMap = bySlot(await liveBookings());
    const now = Date.now();
    return {
      event: EVENT,
      bookingsOpen: BOOKINGS_OPEN,
      modes: Object.values(MODES).map(m => ({ ...m, price: price(m.id, false).base })),
      slots: SLOTS.map(s => ({
        number: s.number,
        label: s.label,
        start: s.start,
        closed: now >= s.startsAt,
        ...slotAvailability(slotMap.get(s.number))
      }))
    };
  },

  'POST /api/promo/check': async (req, body) => {
    rateLimit(req, 'promo', 10);
    const code = normalizeCode(body.code);
    const mode = MODES[String(body.mode || '').toUpperCase()] || MODES.SOLO;
    if (!promoFree(code, await liveBookings())) throw new HttpError(400, 'That code is invalid or has already been used.');
    return { code, ...price(mode.id, true) };
  },

  'POST /api/bookings': async (req, body) => {
    rateLimit(req, 'book', 6);
    if (!BOOKINGS_OPEN) throw new HttpError(403, 'Online booking is closed.');
    if (!UPI_ID) throw new HttpError(503, 'Payments are not set up yet. Please try again later.');
    let parsed;
    try {
      parsed = parseBookingRequest(body);
    } catch (err) {
      throw new HttpError(400, err.message);
    }
    const { mode, slot, players, squadName, promoCode } = parsed;
    if (Date.now() >= slot.startsAt) throw new HttpError(400, 'This slot has already started. Pick a later one.');

    const booking = await locked(async () => {
      const live = await liveBookings();
      const slotBookings = bySlot(live).get(slot.number);

      const taken = new Set();
      for (const b of slotBookings) {
        for (const p of JSON.parse(b.players_json)) { taken.add(p.email); taken.add(p.phone); }
      }
      const clash = players.find(p => taken.has(p.email) || taken.has(p.phone));
      if (clash) throw new HttpError(409, `${clash.name} is already booked in this slot.`);

      const team = assignTeam(slotBookings, mode.id);
      if (!team) {
        throw new HttpError(409, mode.seats > 1
          ? `No free team side left for a ${mode.label} in this slot. Try another slot.`
          : 'This slot is full. Try another slot.');
      }

      if (promoCode && !promoFree(promoCode, live)) {
        throw new HttpError(400, 'That promo code is invalid or has already been used.');
      }

      const cost = price(mode.id, Boolean(promoCode));
      const now = Date.now();
      return saveBooking({
        id: `LT-${randomId(8)}`,
        slot: slot.number,
        team,
        mode: mode.id,
        seats: mode.seats,
        squad_name: squadName || `${players[0].name} (Solo)`,
        lead_name: players[0].name,
        lead_email: players[0].email,
        lead_phone: players[0].phone,
        players_json: JSON.stringify(players),
        base_amount: cost.base,
        discount: cost.discount,
        amount: cost.total,
        promo_code: promoCode || null,
        status: 'HOLD',
        hold_expires_at: now + HOLD_MINUTES * 60 * 1000,
        created_at: now
      });
    });

    return publicTicket(booking);
  },

  'GET /api/bookings/:id': async (req, body, params) => {
    rateLimit(req, 'status', 60);
    const booking = await getBooking(params.id);
    if (!booking) throw new HttpError(404, 'Booking not found.');
    if (booking.status === 'HOLD' && booking.hold_expires_at < Date.now()) booking.status = 'EXPIRED';
    return publicTicket(booking);
  },

  'POST /api/bookings/:id/payment': async (req, body, params) => {
    rateLimit(req, 'utr', 8);
    const utr = String(body.utr || '').replace(/\s/g, '');
    if (!/^\d{12}$/.test(utr)) {
      throw new HttpError(400, 'Enter the 12-digit UTR / UPI reference number from your payment app.');
    }
    const screenshot = String(body.screenshot || '');
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(screenshot)) {
      throw new HttpError(400, 'Attach a screenshot of the payment.');
    }
    if (screenshot.length > MAX_SCREENSHOT_CHARS) throw new HttpError(413, 'Screenshot is too large. Try a smaller image.');

    const updated = await locked(async () => {
      const b = await getBooking(params.id);
      if (!b) throw new HttpError(404, 'Booking not found.');
      if (b.status !== 'HOLD' && b.status !== 'EXPIRED') {
        throw new HttpError(409, 'Payment details were already submitted for this booking.');
      }

      const live = await liveBookings();
      const others = live.filter(o => o.id !== b.id);
      if (others.some(o => o.utr === utr)) throw new HttpError(409, 'That UTR has already been used for another booking.');

      const notes = [];
      let { team, promo_code: promo } = b;
      if (!isLive(b)) {
        // Paid after the hold lapsed: re-seat if possible, otherwise flag for the admin.
        const seat = assignTeam(bySlot(others).get(b.slot), b.mode);
        if (seat) {
          team = seat;
          notes.push('Submitted after the 15-min hold expired.');
        } else {
          notes.push('Submitted after the hold expired and the slot has since filled — move or refund.');
        }
        if (promo && others.some(o => o.promo_code === promo)) {
          notes.push(`Promo ${promo} was re-used by another booking — they paid the discounted ₹${b.amount}.`);
          promo = null;
        }
      }

      const now = Date.now();
      await db.execute(
        'INSERT OR REPLACE INTO lt_payment_proofs (booking_id, image, created_at) VALUES (?, ?, ?)',
        [b.id, screenshot, now]
      );
      return saveBooking({
        ...b,
        status: 'PENDING',
        team,
        promo_code: promo,
        utr,
        utr_submitted_at: now,
        proof_hash: sha256(screenshot),
        note: notes.join(' ') || null
      });
    });

    console.log(`[payment] ${updated.id} slot ${updated.slot} ₹${updated.amount} utr ${utr}`);
    return publicTicket(updated);
  },

  'POST /api/lookup': async (req, body) => {
    rateLimit(req, 'lookup', 8);
    const email = String(body.email || '').trim().toLowerCase();
    const ref = String(body.ref || '').trim().toUpperCase();
    const phone = ref.replace(/\D/g, '').slice(-10);
    if (!email || !ref) throw new HttpError(400, 'Enter your booking ID or phone, and the lead player’s email.');
    const { rows } = await db.execute(
      `SELECT * FROM lt_bookings WHERE status IN ('PENDING', 'PAID', 'REJECTED') AND lead_email = ? AND (id = ? OR lead_phone = ?)
       ORDER BY slot`,
      [email, ref, phone.length === 10 ? phone : '__none__']
    );
    const tickets = verified(rows);
    if (!tickets.length) throw new HttpError(404, 'No booking matches those details.');
    return { tickets: tickets.map(publicTicket) };
  },

  'POST /api/admin/login': async (req, body) => {
    rateLimit(req, 'admin-login', 5);
    if (!ADMIN_PASSWORD) throw new HttpError(503, 'Admin password is not configured.');
    if (!safeEqual(sha256(String(body.password || '')), sha256(ADMIN_PASSWORD))) throw new HttpError(401, 'Wrong password.');
    return { token: signAdminToken() };
  },

  'GET /api/admin/overview': async req => {
    requireAdmin(req);
    const { rows } = await db.execute(
      `SELECT * FROM lt_bookings WHERE status IN ('HOLD', 'PENDING', 'PAID', 'REJECTED') ORDER BY slot, team, created_at`
    );
    const good = verified(rows);
    const now = Date.now();
    const shown = good.filter(b => b.status === 'REJECTED' || isLive(b, now));
    const live = shown.filter(b => b.status !== 'REJECTED');
    const byCode = new Map(live.filter(b => b.promo_code).map(b => [b.promo_code, b]));
    return {
      upiId: UPI_ID,
      tamperedRows: rows.filter(r => !good.includes(r)).map(r => r.id),
      slots: SLOTS.map(s => ({
        number: s.number,
        label: s.label,
        ...slotAvailability(live.filter(b => b.slot === s.number))
      })),
      bookings: shown.map(b => ({
        ...b,
        sig: undefined,
        players: JSON.parse(b.players_json),
        players_json: undefined,
        slotLabel: getSlot(b.slot).label
      })),
      promoCodes: [...PROMO_CODES].sort().map(code => {
        const b = byCode.get(code);
        return {
          code,
          status: !b ? 'UNUSED' : b.status === 'PAID' ? 'USED' : 'HELD',
          bookingId: b?.id || null,
          leadName: b?.lead_name || null
        };
      })
    };
  },

  'GET /api/admin/proof/:id': async (req, body, params) => {
    requireAdmin(req);
    const b = await getBooking(params.id);
    const { rows } = await db.execute('SELECT image FROM lt_payment_proofs WHERE booking_id = ?', [params.id.toUpperCase()]);
    if (!b || !rows.length) throw new HttpError(404, 'No screenshot for this booking.');
    if (sha256(rows[0].image) !== b.proof_hash) {
      throw new HttpError(409, 'This screenshot was altered after it was uploaded. Don’t trust it; check the UTR in your bank app.');
    }
    return { image: rows[0].image };
  },

  'POST /api/admin/review': async (req, body) => {
    requireAdmin(req);
    const id = String(body.bookingId || '').trim().toUpperCase();
    const approve = body.action === 'approve';
    if (!approve && body.action !== 'reject') throw new HttpError(400, 'Action must be approve or reject.');
    const reason = String(body.reason || '').trim().slice(0, 200) || 'We couldn’t find this payment.';
    await locked(async () => {
      const b = await getBooking(id);
      if (!b || b.status !== 'PENDING') throw new HttpError(404, 'No booking awaiting verification with that ID.');
      await saveBooking(approve
        ? { ...b, status: 'PAID', reviewed_at: Date.now() }
        : { ...b, status: 'REJECTED', reviewed_at: Date.now(), note: reason });
    });
    console.log(`[review] ${id} ${approve ? 'approved' : `rejected: ${reason}`}`);
    return { ok: true };
  },

  'POST /api/admin/checkin': async (req, body) => {
    requireAdmin(req);
    const id = String(body.bookingId || '').trim().toUpperCase();
    await locked(async () => {
      const b = await getBooking(id);
      if (!b || b.status !== 'PAID') throw new HttpError(404, 'No approved booking with that ID.');
      await saveBooking({ ...b, checked_in_at: body.undo ? null : Date.now() });
    });
    return { ok: true };
  }
};

function matchRoute(method, path) {
  for (const [key, handler] of Object.entries(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const pp = pattern.split('/');
    const ap = path.split('/');
    if (pp.length !== ap.length) continue;
    const params = {};
    if (pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(ap[i])), true) : seg === ap[i]))) {
      return { handler, params };
    }
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new HttpError(413, 'Request too large.')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

/** Route a request; returns { status, data }. Exported for in-process tests. */
export async function dispatch(req, method, rawUrl, readJson) {
  try {
    const path = new URL(rawUrl, 'http://x').pathname.replace(/\/+$/, '') || '/';
    const route = matchRoute(method, path);
    if (!route) return { status: 404, data: { error: 'Not found' } };
    const body = method === 'POST' ? await readJson() : {};
    return { status: 200, data: await route.handler(req, body, route.params) };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, data: { error: err.message } };
    console.error('[error]', err);
    return { status: 500, data: { error: 'Something went wrong. Please try again.' } };
  }
}

/** Create the lt_* tables if missing (safe to run on every boot). */
export async function migrate() {
  const statements = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
    .replace(/--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
  await db.batch(statements);
}

export { expireHolds, signRow };

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const { status, data } = await dispatch(req, req.method, req.url, () => readBody(req));
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
});

if (env.NODE_ENV !== 'test') {
  await migrate();
  setInterval(() => expireHolds().catch(err => console.error('[expire]', err.message)), 30_000).unref();

  server.listen(PORT, () => {
    console.log(
      `Laser tag API on :${PORT} · UPI ${UPI_ID || '(not set)'} · ${PROMO_CODES.size} promo codes · origins ${ALLOWED_ORIGINS.join(', ')}`
    );
  });
}
