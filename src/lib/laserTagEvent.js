// Event config + pure booking logic (no I/O).

export const EVENT = {
  name: 'DotSlash × Glitch · Laser Tag',
  dateLabel: 'Sunday, 2 November 2026',
  timeLabel: '8:00 PM – 1:00 AM',
  venue: 'Learning Commons A&B',
  slotMinutes: 20,
  pricePerPlayer: 100,
  promoPercent: 10
};

export const MODES = {
  SOLO: { id: 'SOLO', label: 'Solo', seats: 1 },
  TRIO: { id: 'TRIO', label: 'Trio', seats: 3 },
  SQUAD: { id: 'SQUAD', label: 'Squad', seats: 4 }
};

export const SEATS_PER_TEAM = 4;
export const TEAMS = ['A', 'B'];
export const HOLD_MINUTES = 15;

// 8:00 PM IST on 2 Nov 2026 = 14:30 UTC
const FIRST_SLOT_UTC = Date.UTC(2026, 10, 2, 14, 30);
const IST_OFFSET_MS = 330 * 60 * 1000;

function istClock(ms) {
  const d = new Date(ms + IST_OFFSET_MS);
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export const SLOTS = Array.from({ length: 15 }, (_, i) => {
  const startsAt = FIRST_SLOT_UTC + i * EVENT.slotMinutes * 60 * 1000;
  const endsAt = startsAt + EVENT.slotMinutes * 60 * 1000;
  return {
    number: i + 1,
    startsAt,
    endsAt,
    label: `${istClock(startsAt)} – ${istClock(endsAt)}`,
    start: istClock(startsAt)
  };
});

export function getSlot(number) {
  return SLOTS.find(s => s.number === Number(number)) || null;
}

function sideState(bookings, team) {
  const onSide = bookings.filter(b => b.team === team);
  return {
    team,
    seats: onSide.reduce((n, b) => n + Number(b.seats || 0), 0),
    hasTrio: onSide.some(b => b.mode === 'TRIO')
  };
}

/**
 * Pick a team side for a new booking, given the slot's active bookings.
 * - SQUAD takes a whole empty side.
 * - TRIO takes 3 seats of an empty side; the 4th seat is left for a solo.
 * - SOLO fills a trio's spare seat first, then joins other solos (keeping
 *   empty sides free for squads/trios), and only then opens an empty side.
 * Returns 'A' | 'B' | null when the mode can't fit.
 */
export function assignTeam(bookings, modeId) {
  const sides = TEAMS.map(t => sideState(bookings, t));

  if (modeId === 'SQUAD' || modeId === 'TRIO') {
    return sides.find(s => s.seats === 0)?.team ?? null;
  }

  const open = sides.filter(s => s.seats < SEATS_PER_TEAM);
  const trioSide = open.find(s => s.hasTrio);
  if (trioSide) return trioSide.team;
  const partial = open.filter(s => s.seats > 0).sort((a, b) => b.seats - a.seats)[0];
  if (partial) return partial.team;
  return open[0]?.team ?? null;
}

export function slotAvailability(bookings) {
  const sides = TEAMS.map(t => sideState(bookings, t));
  const used = sides.reduce((n, s) => n + s.seats, 0);
  return {
    seatsLeft: Math.max(0, TEAMS.length * SEATS_PER_TEAM - used),
    canSolo: assignTeam(bookings, 'SOLO') !== null,
    canTrio: assignTeam(bookings, 'TRIO') !== null,
    canSquad: assignTeam(bookings, 'SQUAD') !== null
  };
}

export function price(modeId, hasPromo) {
  const base = MODES[modeId].seats * EVENT.pricePerPlayer;
  const discount = hasPromo ? Math.round((base * EVENT.promoPercent) / 100) : 0;
  return { base, discount, total: base - discount };
}

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate + normalise a booking request body. Throws Error(message) on bad input. */
export function parseBookingRequest(body) {
  const mode = MODES[String(body?.mode || '').toUpperCase()];
  if (!mode) throw new Error('Choose Solo, Trio or Squad.');

  const slot = getSlot(body.slot);
  if (!slot) throw new Error('Choose a valid time slot.');

  const rawPlayers = Array.isArray(body.players) ? body.players : [];
  if (rawPlayers.length !== mode.seats) {
    throw new Error(`${mode.label} bookings need exactly ${mode.seats} player${mode.seats > 1 ? 's' : ''}.`);
  }

  const players = rawPlayers.map((p, i) => {
    const who = i === 0 ? 'the lead player' : `player ${i + 1}`;
    const name = String(p?.name || '').trim().slice(0, 80);
    const email = String(p?.email || '').trim().toLowerCase().slice(0, 120);
    const phone = String(p?.phone || '').replace(/\D/g, '').slice(-10);
    const studentId = String(p?.studentId || '').trim().slice(0, 40);
    if (!name) throw new Error(`Enter a name for ${who}.`);
    if (!EMAIL_RE.test(email)) throw new Error(`Enter a valid email for ${who}.`);
    if (phone.length !== 10) throw new Error(`Enter a 10-digit phone number for ${who}.`);
    return { name, email, phone, studentId };
  });

  const emails = new Set(players.map(p => p.email));
  const phones = new Set(players.map(p => p.phone));
  if (emails.size !== players.length || phones.size !== players.length) {
    throw new Error('Each player needs their own email and phone number.');
  }

  const squadName = mode.seats > 1 ? String(body.squadName || '').trim().slice(0, 40) : '';
  if (mode.seats > 1 && !squadName) throw new Error('Enter a squad name.');

  return { mode, slot, players, squadName, promoCode: normalizeCode(body.promoCode) };
}
