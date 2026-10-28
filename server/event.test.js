import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, assignTeam, slotAvailability, price, parseBookingRequest } from './event.js';

const b = (team, mode) => ({ team, mode, seats: { SOLO: 1, TRIO: 3, SQUAD: 4 }[mode] });

test('15 slots from 8:00 PM to 1:00 AM IST on 2 Nov', () => {
  assert.equal(SLOTS.length, 15);
  assert.equal(SLOTS[0].label, '8:00 PM – 8:20 PM');
  assert.equal(SLOTS[11].label, '11:40 PM – 12:00 AM');
  assert.equal(SLOTS[14].label, '12:40 AM – 1:00 AM');
  assert.equal(new Date(SLOTS[0].startsAt).toISOString(), '2026-11-02T14:30:00.000Z');
});

test('squad and trio need an empty side', () => {
  assert.equal(assignTeam([], 'SQUAD'), 'A');
  assert.equal(assignTeam([b('A', 'SQUAD')], 'SQUAD'), 'B');
  assert.equal(assignTeam([b('A', 'SQUAD'), b('B', 'TRIO')], 'SQUAD'), null);
  assert.equal(assignTeam([b('A', 'SOLO')], 'TRIO'), 'B');
  assert.equal(assignTeam([b('A', 'SOLO'), b('B', 'SOLO')], 'TRIO'), null);
});

test('solo fills trio gap first, then other solos, then an empty side', () => {
  assert.equal(assignTeam([b('A', 'SQUAD'), b('B', 'TRIO')], 'SOLO'), 'B');
  assert.equal(assignTeam([b('A', 'TRIO'), b('B', 'SOLO')], 'SOLO'), 'A');
  assert.equal(assignTeam([b('B', 'SOLO')], 'SOLO'), 'B');
  assert.equal(assignTeam([], 'SOLO'), 'A');
  const fullA = [b('A', 'SOLO'), b('A', 'SOLO'), b('A', 'SOLO'), b('A', 'SOLO')];
  assert.equal(assignTeam(fullA, 'SOLO'), 'B');
  assert.equal(assignTeam([...fullA, b('B', 'SQUAD')], 'SOLO'), null);
});

test('availability counts seats left', () => {
  const a = slotAvailability([b('A', 'TRIO')]);
  assert.deepEqual(a, { seatsLeft: 5, canSolo: true, canTrio: true, canSquad: true });
  const full = slotAvailability([b('A', 'SQUAD'), b('B', 'SQUAD')]);
  assert.deepEqual(full, { seatsLeft: 0, canSolo: false, canTrio: false, canSquad: false });
});

test('10% promo pricing', () => {
  assert.deepEqual(price('SOLO', true), { base: 100, discount: 10, total: 90 });
  assert.deepEqual(price('TRIO', true), { base: 300, discount: 30, total: 270 });
  assert.deepEqual(price('SQUAD', false), { base: 400, discount: 0, total: 400 });
});

test('booking request validation', () => {
  const p = (n) => ({ name: `P${n}`, email: `p${n}@flame.edu.in`, phone: `98765432${10 + n}` });
  const ok = parseBookingRequest({ mode: 'trio', slot: 3, squadName: 'Neon', players: [p(1), p(2), p(3)], promoCode: ' zap-abcde ' });
  assert.equal(ok.mode.id, 'TRIO');
  assert.equal(ok.promoCode, 'ZAP-ABCDE');
  assert.throws(() => parseBookingRequest({ mode: 'TRIO', slot: 3, squadName: 'N', players: [p(1), p(2)] }), /exactly 3/);
  assert.throws(() => parseBookingRequest({ mode: 'TRIO', slot: 3, squadName: 'N', players: [p(1), p(1), p(2)] }), /own email/);
  assert.throws(() => parseBookingRequest({ mode: 'SOLO', slot: 16, players: [p(1)] }), /valid time slot/);
  assert.throws(() => parseBookingRequest({ mode: 'SQUAD', slot: 1, players: [p(1), p(2), p(3), p(4)] }), /squad name/);
});
