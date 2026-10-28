// End-to-end API test with no network: node:sqlite stands in for Turso and a
// stubbed fetch routes Turso HTTP calls to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const sqlite = new DatabaseSync(':memory:');

function cell(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'bigint' || Number.isInteger(v)) return { type: 'integer', value: String(v) };
  if (typeof v === 'number') return { type: 'float', value: v };
  return { type: 'text', value: String(v) };
}

function runPipeline(requests) {
  return requests.filter(r => r.type === 'execute').map(({ stmt }) => {
    const args = (stmt.args || []).map(a => (a.type === 'null' ? null : a.type === 'integer' ? Number(a.value) : a.value));
    try {
      const prepared = sqlite.prepare(stmt.sql);
      if (/^\s*(SELECT|WITH)/i.test(stmt.sql)) {
        const rows = prepared.all(...args);
        const cols = prepared.columns().map(c => ({ name: c.name }));
        return { type: 'ok', response: { type: 'execute', result: { cols, rows: rows.map(r => cols.map(c => cell(r[c.name]))), affected_row_count: 0 } } };
      }
      const info = prepared.run(...args);
      return { type: 'ok', response: { type: 'execute', result: { cols: [], rows: [], affected_row_count: Number(info.changes) } } };
    } catch (err) {
      return { type: 'error', error: { message: err.message } };
    }
  });
}

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.host === 'db.test') return json(200, { results: runPipeline(JSON.parse(opts.body).requests) });
  throw new Error(`unexpected fetch ${url}`);
};

Object.assign(process.env, {
  NODE_ENV: 'test',
  SIGNING_SECRET: 'test-signing-secret-0123456789abcdef',
  PROMO_CODES: 'ZAP-AAAAA, beam-bbbbb',
  TURSO_DATABASE_URL: 'https://db.test',
  TURSO_AUTH_TOKEN: 'x',
  UPI_ID: 'dotslash@okaxis',
  UPI_NAME: 'DotSlash FLAME',
  ADMIN_PASSWORD: 'letmein',
});

const { dispatch, expireHolds, migrate, signRow } = await import('./index.js');
await migrate();

let ipSeq = 0;
async function call(method, path, body, token) {
  const req = { headers: { 'x-forwarded-for': `10.0.0.${++ipSeq}`, authorization: token ? `Bearer ${token}` : '' }, socket: {} };
  return dispatch(req, method, path, async () => body || {});
}

let phoneSeq = 1000;
const player = () => { const n = ++phoneSeq; return { name: `Player ${n}`, email: `p${n}@flame.edu.in`, phone: `987654${n}` }; };
const book = (slot, mode, extra = {}) => {
  const seats = { SOLO: 1, TRIO: 3, SQUAD: 4 }[mode];
  return call('POST', '/api/bookings', { slot, mode, squadName: 'Neon', players: Array.from({ length: seats }, player), ...extra });
};
const SHOT = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');
let utrSeq = 400000000000;
const submit = (id, extra = {}) => call('POST', `/api/bookings/${id}/payment`, { utr: String(++utrSeq), screenshot: SHOT, ...extra });
const statusOf = id => sqlite.prepare('SELECT status, note, team, promo_code FROM lt_bookings WHERE id = ?').get(id);
// Simulates time passing by re-signing the row as the server would.
const expire = id => {
  const row = sqlite.prepare('SELECT * FROM lt_bookings WHERE id = ?').get(id);
  row.hold_expires_at = 1;
  sqlite.prepare('UPDATE lt_bookings SET hold_expires_at = 1, sig = ? WHERE id = ?').run(signRow(row), id);
};
let adminToken;
const admin = async (method, path, body) => {
  adminToken ||= (await call('POST', '/api/admin/login', { password: 'letmein' })).data.token;
  return call(method, path, body, adminToken);
};

test('event lists 15 open slots with 8 seats', async () => {
  const { status, data } = await call('GET', '/api/event');
  assert.equal(status, 200);
  assert.equal(data.slots.length, 15);
  assert.ok(data.slots.every(s => s.seatsLeft === 8 && !s.closed));
});

test('seat allocation, server-side pricing and UPI details', async () => {
  const trio = await book(1, 'TRIO', { promoCode: 'zap-aaaaa', amount: 1 });
  assert.equal(trio.status, 200, JSON.stringify(trio.data));
  assert.equal(trio.data.team, 'A');
  assert.equal(trio.data.amount, 270, 'client-sent amount is ignored');
  assert.equal(trio.data.payment.upiId, 'dotslash@okaxis');
  assert.match(trio.data.payment.link, /^upi:\/\/pay\?pa=dotslash%40okaxis&pn=DotSlash%20FLAME&am=270\.00&cu=INR&tn=LT-/);

  assert.equal((await call('POST', '/api/promo/check', { code: 'ZAP-AAAAA' })).status, 400, 'held code cannot be re-used');
  assert.equal((await book(2, 'SOLO', { promoCode: 'ZAP-AAAAA' })).status, 400);

  const squad = await book(1, 'SQUAD');
  assert.equal(squad.data.team, 'B');
  assert.equal((await book(1, 'SQUAD')).status, 409, 'no empty side left');
  const solo = await book(1, 'SOLO');
  assert.equal(solo.data.team, 'A', 'solo fills the trio gap');
  assert.equal((await book(1, 'SOLO')).status, 409, 'slot full');

  // Unpaid squad hold expires and frees its side.
  expire(squad.data.id);
  await expireHolds();
  assert.equal(statusOf(squad.data.id).status, 'EXPIRED');
  const ev = await call('GET', '/api/event');
  assert.equal(ev.data.slots[0].seatsLeft, 4);
  assert.equal(ev.data.slots[0].canSquad, true);
});

test('payment submission needs a 12-digit UTR and a screenshot, and UTRs are single-use', async () => {
  const a = await book(6, 'SOLO');
  assert.equal((await submit(a.data.id, { utr: '123' })).status, 400);
  assert.equal((await submit(a.data.id, { screenshot: '' })).status, 400);
  assert.equal((await submit(a.data.id, { screenshot: 'data:text/html;base64,PGh0bWw+' })).status, 400);
  const ok = await submit(a.data.id, { utr: '111122223333' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.status, 'PENDING');
  assert.equal(ok.data.payment, null);
  assert.equal((await submit(a.data.id)).status, 409, 'cannot resubmit');

  const b = await book(6, 'SOLO');
  assert.equal((await submit(b.data.id, { utr: '111122223333' })).status, 409, 'UTR already claimed');
  assert.equal(statusOf(b.data.id).status, 'HOLD');

  // Pending bookings keep their seats even long after the 15-min hold.
  expire(a.data.id);
  await expireHolds();
  assert.equal(statusOf(a.data.id).status, 'PENDING');
});

test('admin approves → ticket; reject releases seats and promo', async () => {
  const ok = await book(7, 'SQUAD', { promoCode: 'BEAM-BBBBB' });
  assert.equal(ok.data.amount, 360);
  await submit(ok.data.id);

  const proof = await admin('GET', `/api/admin/proof/${ok.data.id}`);
  assert.equal(proof.data.image, SHOT);
  assert.equal((await call('GET', `/api/admin/proof/${ok.data.id}`)).status, 401, 'proof is admin-only');

  assert.equal((await admin('POST', '/api/admin/review', { bookingId: ok.data.id, action: 'reject', reason: 'Not received' })).status, 200);
  const rejected = await call('GET', `/api/bookings/${ok.data.id}`);
  assert.equal(rejected.data.status, 'REJECTED');
  assert.equal(rejected.data.rejectionReason, 'Not received');
  assert.equal((await call('POST', '/api/promo/check', { code: 'BEAM-BBBBB', mode: 'SOLO' })).status, 200, 'promo released');
  assert.equal((await call('GET', '/api/event')).data.slots[6].seatsLeft, 8, 'seats released');

  const trio = sqlite.prepare("SELECT id FROM lt_bookings WHERE mode = 'TRIO' AND slot = 1").get();
  await submit(trio.id);
  assert.equal((await admin('POST', '/api/admin/review', { bookingId: trio.id, action: 'approve' })).status, 200);
  assert.equal((await call('GET', `/api/bookings/${trio.id}`)).data.status, 'PAID');
  assert.equal((await admin('POST', '/api/admin/review', { bookingId: trio.id, action: 'approve' })).status, 404, 'only PENDING can be reviewed');

  const overview = await admin('GET', '/api/admin/overview');
  assert.equal(overview.data.promoCodes.find(p => p.code === 'ZAP-AAAAA').status, 'USED');
  assert.equal(overview.data.promoCodes.find(p => p.code === 'BEAM-BBBBB').status, 'UNUSED');
});

test('payment submitted after the hold lapsed is accepted but flagged', async () => {
  const late = await book(8, 'SOLO');
  expire(late.data.id);
  await expireHolds();
  const res = await submit(late.data.id);
  assert.equal(res.status, 200);
  assert.equal(statusOf(late.data.id).status, 'PENDING');
  assert.match(statusOf(late.data.id).note, /hold expired/);
});

test('same person cannot be booked twice in a slot', async () => {
  const p = player();
  assert.equal((await call('POST', '/api/bookings', { slot: 5, mode: 'SOLO', players: [p] })).status, 200);
  const dup = await call('POST', '/api/bookings', { slot: 5, mode: 'SOLO', players: [{ ...p, email: 'other@flame.edu.in' }] });
  assert.equal(dup.status, 409);
});

test('started slots are closed', async () => {
  const realNow = Date.now;
  Date.now = () => Date.UTC(2026, 10, 2, 14, 31);
  try {
    assert.equal((await book(1, 'SOLO')).status, 400);
    assert.equal((await call('GET', '/api/event')).data.slots[0].closed, true);
  } finally {
    Date.now = realNow;
  }
});

test('lookup and admin check-in', async () => {
  const { id, lead_email, lead_phone } = sqlite.prepare("SELECT * FROM lt_bookings WHERE status = 'PAID'").get();
  const found = await call('POST', '/api/lookup', { ref: lead_phone, email: lead_email });
  assert.equal(found.status, 200);
  assert.equal(found.data.tickets[0].id, id);
  assert.equal((await call('POST', '/api/lookup', { ref: id, email: 'wrong@x.com' })).status, 404);

  assert.equal((await call('POST', '/api/admin/login', { password: 'nope' })).status, 401);
  assert.equal((await call('GET', '/api/admin/overview')).status, 401);
  assert.equal((await admin('POST', '/api/admin/checkin', { bookingId: id })).status, 200);
  assert.ok(sqlite.prepare('SELECT checked_in_at FROM lt_bookings WHERE id = ?').get(id).checked_in_at);
});

test('rows written or edited with the public DB token are ignored', async () => {
  // Forged "paid" squad straight into the table, as someone with the browser token could.
  const forged = sqlite.prepare("SELECT * FROM lt_bookings WHERE status = 'PAID'").get();
  sqlite.prepare("INSERT INTO lt_bookings SELECT 'LT-FORGED01', 9, team, 'SQUAD', 4, squad_name, lead_name, 'f@x.com', '9000000000', players_json, 400, 0, 400, 'PEW-NOPE1', 'PAID', NULL, '999999999999', 1, NULL, 1, 1, NULL, NULL, 'bogus' FROM lt_bookings WHERE id = ?").run(forged.id);
  assert.equal((await call('GET', '/api/bookings/LT-FORGED01')).status, 404);
  assert.equal((await call('GET', '/api/event')).data.slots[8].seatsLeft, 8, 'forged seats not counted');
  assert.equal((await call('POST', '/api/lookup', { ref: '9000000000', email: 'f@x.com' })).status, 404);
  assert.equal((await admin('POST', '/api/admin/checkin', { bookingId: 'LT-FORGED01' })).status, 404);

  // Flipping a pending booking to PAID directly breaks its signature.
  const pending = sqlite.prepare("SELECT id FROM lt_bookings WHERE status = 'PENDING'").get();
  sqlite.prepare("UPDATE lt_bookings SET status = 'PAID' WHERE id = ?").run(pending.id);
  assert.equal((await call('GET', `/api/bookings/${pending.id}`)).status, 404);

  const overview = await admin('GET', '/api/admin/overview');
  assert.ok(overview.data.tamperedRows.includes('LT-FORGED01'));
  assert.ok(overview.data.tamperedRows.includes(pending.id));
  assert.ok(!overview.data.bookings.some(b => b.id === 'LT-FORGED01'));

  // Promo codes come from env, so inventing one doesn't work.
  assert.equal((await call('POST', '/api/promo/check', { code: 'PEW-NOPE1' })).status, 400);
});

test('a swapped screenshot is detected', async () => {
  const b = sqlite.prepare("SELECT booking_id FROM lt_payment_proofs JOIN lt_bookings ON id = booking_id WHERE status = 'REJECTED'").get();
  assert.equal((await admin('GET', `/api/admin/proof/${b.booking_id}`)).status, 200);
  sqlite.prepare("UPDATE lt_payment_proofs SET image = 'data:image/jpeg;base64,AAAA' WHERE booking_id = ?").run(b.booking_id);
  const res = await admin('GET', `/api/admin/proof/${b.booking_id}`);
  assert.equal(res.status, 409);
});
