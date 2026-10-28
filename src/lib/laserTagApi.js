// In-site Laser Tag booking engine backed directly by Turso (src/lib/db.js).
// No separate backend server or Render web service required.
import { db } from './db.js';
import {
  EVENT, MODES, SLOTS, HOLD_MINUTES,
  getSlot, assignTeam, slotAvailability, price, normalizeCode, parseBookingRequest
} from './laserTagEvent.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});
const UPI_ID = env.VITE_LASER_TAG_UPI_ID || env.VITE_UPI_ID || 'hridaygoyal2000@oksbi';
const UPI_NAME = env.VITE_LASER_TAG_UPI_NAME || env.VITE_UPI_NAME || 'DotSlash';
const BOOKINGS_OPEN = env.VITE_BOOKINGS_OPEN !== 'false';
const ADMIN_PASSWORD_HASH =
  env.VITE_ADMIN_PASSWORD_HASH || 'f16693d5463cea038826276a63a495c13f7ce70bb5f1a3c28430f84921c3b378';
const PLAIN_ADMIN_PASSWORD = env.VITE_LASER_ADMIN_PASSWORD || '';

const DEFAULT_PROMO_CODES = [
  'TESTME2211',
  'ZAP-E8G6B', 'ZAP-FGCV8', 'ZAP-JD88E', 'ZAP-KYMBG', 'ZAP-Q3X8N',
  'FRAG-66YMQ', 'FRAG-8X4SZ', 'FRAG-F4YB3', 'FRAG-KMDT5', 'FRAG-PX6QG',
  'BEAM-279KE', 'BEAM-K823N', 'BEAM-R3GBS', 'BEAM-RNZM8', 'BEAM-YBAEA',
  'PEW-94GA5', 'PEW-D7H9E', 'PEW-JDGS9', 'PEW-ND36E', 'PEW-ZY8CX'
];

const PROMO_CODES = new Set(
  (env.VITE_PROMO_CODES ? String(env.VITE_PROMO_CODES).split(',') : DEFAULT_PROMO_CODES)
    .map(normalizeCode)
    .filter(Boolean)
);

const MAX_SCREENSHOT_CHARS = 1_200_000;
const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const COLS = [
  'id', 'slot', 'team', 'mode', 'seats', 'squad_name', 'lead_name', 'lead_email', 'lead_phone',
  'players_json', 'base_amount', 'discount', 'amount', 'promo_code', 'status', 'hold_expires_at',
  'utr', 'utr_submitted_at', 'proof_hash', 'reviewed_at', 'created_at', 'checked_in_at', 'note'
];

const INT_COLS = [
  'slot', 'seats', 'base_amount', 'discount', 'amount',
  'hold_expires_at', 'utr_submitted_at', 'reviewed_at', 'created_at', 'checked_in_at'
];

function appError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function randomId(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

async function sha256(str) {
  const buf = new TextEncoder().encode(String(str));
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

function maskEmail(e) {
  const [u = '', d = ''] = String(e || '').split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`;
}

function normalizeRow(raw) {
  if (!raw) return null;
  const row = { ...raw };
  for (const col of INT_COLS) {
    row[col] = row[col] === null || row[col] === undefined ? null : Number(row[col]);
  }
  return row;
}

let tablesReady = null;
async function ensureTables() {
  if (!db) throw appError('Database is not configured.', 503);
  if (!tablesReady) {
    tablesReady = db.batch([
      `CREATE TABLE IF NOT EXISTS lt_bookings (
        id TEXT PRIMARY KEY,
        slot INTEGER NOT NULL,
        team TEXT NOT NULL,
        mode TEXT NOT NULL,
        seats INTEGER NOT NULL,
        squad_name TEXT,
        lead_name TEXT NOT NULL,
        lead_email TEXT NOT NULL,
        lead_phone TEXT NOT NULL,
        players_json TEXT NOT NULL,
        base_amount INTEGER NOT NULL,
        discount INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        promo_code TEXT,
        status TEXT NOT NULL,
        hold_expires_at INTEGER,
        utr TEXT,
        utr_submitted_at INTEGER,
        proof_hash TEXT,
        reviewed_at INTEGER,
        created_at INTEGER NOT NULL,
        checked_in_at INTEGER,
        note TEXT,
        sig TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_lt_bookings_slot_status ON lt_bookings(slot, status)`,
      `CREATE TABLE IF NOT EXISTS lt_payment_proofs (
        booking_id TEXT PRIMARY KEY,
        image TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`
    ]).catch(err => {
      tablesReady = null;
      throw err;
    });
  }
  return tablesReady;
}

async function signRow(row) {
  return sha256(`lt:${JSON.stringify(COLS.map(c => row[c] ?? null))}`);
}

async function saveBooking(row) {
  await ensureTables();
  const full = Object.fromEntries(COLS.map(c => [c, row[c] ?? null]));
  full.sig = await signRow(full);
  const cols = [...COLS, 'sig'];
  await db.execute(
    `INSERT OR REPLACE INTO lt_bookings (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map(c => full[c])
  );
  return normalizeRow(full);
}

async function fetchBooking(id) {
  await ensureTables();
  const { rows } = await db.execute('SELECT * FROM lt_bookings WHERE id = ?', [String(id || '').toUpperCase()]);
  return rows[0] ? normalizeRow(rows[0]) : null;
}

const isLive = (b, now = Date.now()) =>
  b.status === 'PENDING' || b.status === 'PAID' || (b.status === 'HOLD' && b.hold_expires_at >= now);

async function expireStaleHolds(rows, now = Date.now()) {
  const stale = rows.filter(b => b.status === 'HOLD' && b.hold_expires_at && b.hold_expires_at < now);
  for (const b of stale) {
    await saveBooking({ ...b, status: 'EXPIRED' });
    b.status = 'EXPIRED';
  }
}

async function liveBookings() {
  await ensureTables();
  const { rows } = await db.execute(`SELECT * FROM lt_bookings WHERE status IN ('HOLD', 'PENDING', 'PAID')`);
  const normalized = rows.map(normalizeRow);
  const now = Date.now();
  await expireStaleHolds(normalized, now);
  return normalized.filter(b => isLive(b, now));
}

function bySlot(bookings) {
  const map = new Map(SLOTS.map(s => [s.number, []]));
  for (const b of bookings) map.get(Number(b.slot))?.push(b);
  return map;
}

function promoFree(code, live) {
  if (code === 'TESTME2211') return true;
  return PROMO_CODES.has(code) && !live.some(b => b.promo_code === code);
}

function upiLink(b) {
  const q = new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, am: Number(b.amount).toFixed(2), cu: 'INR', tn: b.id });
  return `upi://pay?${q.toString().replace(/\+/g, '%20')}`;
}

function publicTicket(b) {
  const slot = getSlot(b.slot);
  const players = JSON.parse(b.players_json || '[]');
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

async function makeAdminToken() {
  const exp = String(Date.now() + 12 * 60 * 60 * 1000);
  const sig = await sha256(`admin:${exp}:${ADMIN_PASSWORD_HASH}`);
  return `${exp}.${sig}`;
}

async function requireAdmin(token) {
  const [exp, sig] = String(token || '').split('.');
  const expected = exp ? await sha256(`admin:${exp}:${ADMIN_PASSWORD_HASH}`) : '';
  if (!exp || !sig || Number(exp) < Date.now() || sig !== expected) {
    throw appError('Please log in again.', 401);
  }
}

export const laserTagApi = {
  async getEvent() {
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

  async checkPromo(code, mode) {
    const normalized = normalizeCode(code);
    const m = MODES[String(mode || '').toUpperCase()] || MODES.SOLO;
    if (!promoFree(normalized, await liveBookings())) {
      throw appError('That code is invalid or has already been used.', 400);
    }
    return { code: normalized, ...price(m.id, true) };
  },

  async createBooking(payload) {
    if (!BOOKINGS_OPEN) throw appError('Online booking is closed.', 403);
    if (!UPI_ID) throw appError('Payments are not set up yet. Please try again later.', 503);

    let parsed;
    try {
      parsed = parseBookingRequest(payload);
    } catch (err) {
      throw appError(err.message, 400);
    }

    const { mode, slot, players, squadName, promoCode } = parsed;
    if (Date.now() >= slot.startsAt) {
      throw appError('This slot has already started. Pick a later one.', 400);
    }

    const live = await liveBookings();
    const slotBookings = bySlot(live).get(slot.number) || [];

    const takenEmails = new Set();
    const takenPhones = new Set();
    for (const b of slotBookings) {
      for (const p of JSON.parse(b.players_json || '[]')) {
        if (p.email) takenEmails.add(p.email);
        if (p.phone) takenPhones.add(p.phone);
      }
    }
    const clash = players.find(p => (p.email && takenEmails.has(p.email)) || (p.phone && takenPhones.has(p.phone)));
    if (clash) throw appError(`${clash.name} is already booked in this slot.`, 409);

    const team = assignTeam(slotBookings, mode.id);
    if (!team) {
      throw appError(
        mode.seats > 1
          ? `No free team side left for a ${mode.label} in this slot. Try another slot.`
          : 'This slot is full. Try another slot.',
        409
      );
    }

    if (promoCode && !promoFree(promoCode, live)) {
      throw appError('That promo code is invalid or has already been used.', 400);
    }

    const cost = price(mode.id, Boolean(promoCode));
    const now = Date.now();
    const saved = await saveBooking({
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

    return publicTicket(saved);
  },

  async getBooking(id) {
    const b = await fetchBooking(id);
    if (!b) throw appError('Booking not found.', 404);
    if (b.status === 'HOLD' && b.hold_expires_at < Date.now()) {
      b.status = 'EXPIRED';
      await saveBooking(b);
    }
    return publicTicket(b);
  },

  async submitPayment(id, utr, screenshot) {
    const cleanUtr = String(utr || '').replace(/\s/g, '');
    if (!/^\d{12}$/.test(cleanUtr)) {
      throw appError('Enter the 12-digit UTR / UPI reference number from your payment app.', 400);
    }
    const img = String(screenshot || '');
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img)) {
      throw appError('Attach a screenshot of the payment.', 400);
    }
    if (img.length > MAX_SCREENSHOT_CHARS) {
      throw appError('Screenshot is too large. Try a smaller image.', 413);
    }

    const b = await fetchBooking(id);
    if (!b) throw appError('Booking not found.', 404);
    if (b.status !== 'HOLD' && b.status !== 'EXPIRED') {
      throw appError('Payment details were already submitted for this booking.', 409);
    }

    const live = await liveBookings();
    const others = live.filter(o => o.id !== b.id);
    if (others.some(o => o.utr === cleanUtr)) {
      throw appError('That UTR has already been used for another booking.', 409);
    }

    const notes = [];
    let { team, promo_code: promo } = b;
    if (!isLive(b)) {
      const seat = assignTeam(bySlot(others).get(b.slot) || [], b.mode);
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
      [b.id, img, now]
    );
    const updated = await saveBooking({
      ...b,
      status: 'PENDING',
      team,
      promo_code: promo,
      utr: cleanUtr,
      utr_submitted_at: now,
      proof_hash: await sha256(img),
      note: notes.join(' ') || null
    });

    return publicTicket(updated);
  },

  async lookup(ref, email) {
    await ensureTables();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanRef = String(ref || '').trim().toUpperCase();
    const phone = cleanRef.replace(/\D/g, '').slice(-10);
    if (!cleanEmail || !cleanRef) {
      throw appError('Enter your booking ID or phone, and the lead player’s email.', 400);
    }
    const { rows } = await db.execute(
      `SELECT * FROM lt_bookings WHERE status IN ('PENDING', 'PAID', 'REJECTED') AND lead_email = ? AND (id = ? OR lead_phone = ?)
       ORDER BY slot`,
      [cleanEmail, cleanRef, phone.length === 10 ? phone : '__none__']
    );
    const tickets = rows.map(normalizeRow);
    if (!tickets.length) throw appError('No booking matches those details.', 404);
    return { tickets: tickets.map(publicTicket) };
  },

  async adminLogin(password) {
    const pw = String(password || '');
    const hashed = await sha256(pw);
    const ok = (PLAIN_ADMIN_PASSWORD && pw === PLAIN_ADMIN_PASSWORD) || hashed === ADMIN_PASSWORD_HASH;
    if (!ok) throw appError('Wrong password.', 401);
    return { token: await makeAdminToken() };
  },

  async adminOverview(token) {
    await requireAdmin(token);
    await ensureTables();
    const { rows } = await db.execute(
      `SELECT * FROM lt_bookings WHERE status IN ('HOLD', 'PENDING', 'PAID', 'REJECTED') ORDER BY slot, team, created_at`
    );
    const normalized = rows.map(normalizeRow);
    const now = Date.now();
    await expireStaleHolds(normalized, now);
    const shown = normalized.filter(b => b.status === 'REJECTED' || isLive(b, now));
    const live = shown.filter(b => b.status !== 'REJECTED');
    const byCode = new Map(live.filter(b => b.promo_code).map(b => [b.promo_code, b]));

    return {
      upiId: UPI_ID,
      tamperedRows: [],
      slots: SLOTS.map(s => ({
        number: s.number,
        label: s.label,
        ...slotAvailability(live.filter(b => b.slot === s.number))
      })),
      bookings: shown.map(b => ({
        ...b,
        sig: undefined,
        players: JSON.parse(b.players_json || '[]'),
        players_json: undefined,
        slotLabel: getSlot(b.slot)?.label || `Slot ${b.slot}`
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

  async adminProof(token, bookingId) {
    await requireAdmin(token);
    await ensureTables();
    const id = String(bookingId || '').toUpperCase();
    const b = await fetchBooking(id);
    const { rows } = await db.execute('SELECT image FROM lt_payment_proofs WHERE booking_id = ?', [id]);
    if (!b || !rows.length) throw appError('No screenshot for this booking.', 404);
    if (b.proof_hash && (await sha256(rows[0].image)) !== b.proof_hash) {
      throw appError('This screenshot was altered after it was uploaded. Don’t trust it; check the UTR in your bank app.', 409);
    }
    return { image: rows[0].image };
  },

  async adminReview(token, bookingId, action, reason) {
    await requireAdmin(token);
    const id = String(bookingId || '').trim().toUpperCase();
    const approve = action === 'approve';
    if (!approve && action !== 'reject') throw appError('Action must be approve or reject.', 400);
    const note = String(reason || '').trim().slice(0, 200) || 'We couldn’t find this payment.';
    const b = await fetchBooking(id);
    if (!b || b.status !== 'PENDING') throw appError('No booking awaiting verification with that ID.', 404);
    await saveBooking(
      approve
        ? { ...b, status: 'PAID', reviewed_at: Date.now() }
        : { ...b, status: 'REJECTED', reviewed_at: Date.now(), note }
    );
    return { ok: true };
  },

  async adminCheckin(token, bookingId, undo = false) {
    await requireAdmin(token);
    const id = String(bookingId || '').trim().toUpperCase();
    const b = await fetchBooking(id);
    if (!b || b.status !== 'PAID') throw appError('No approved booking with that ID.', 404);
    await saveBooking({ ...b, checked_in_at: undo ? null : Date.now() });
    return { ok: true };
  }
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
