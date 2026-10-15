import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const envSource = fs.readFileSync(envPath, 'utf8');
  envSource.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  });
}

const url = env.VITE_TURSO_DATABASE_URL || process.env.VITE_TURSO_DATABASE_URL;
const token = env.VITE_TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN;

if (!url || !token) {
  console.error('Missing VITE_TURSO_DATABASE_URL or VITE_TURSO_AUTH_TOKEN');
  process.exit(1);
}

const pipelineUrl = url.replace(/\/$/, '') + '/v2/pipeline';

async function execute(sql, args = []) {
  const formattedArgs = args.map(a => {
    if (a === null || a === undefined) return { type: 'null' };
    if (typeof a === 'number') return { type: 'integer', value: String(a) };
    return { type: 'text', value: String(a) };
  });

  const res = await fetch(pipelineUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ type: 'execute', stmt: { sql, args: formattedArgs } }]
    })
  });

  if (!res.ok) throw new Error(`Turso HTTP Error: ${res.status}`);
  const data = await res.json();
  const result = data.results[0];
  if (result.type === 'error') throw new Error(result.error.message);
  return result.response.result;
}

export const UPI_CONFIG = {
  HRIDAY: {
    name: 'Hriday Goyal',
    upiId: 'hridaygoyal2000@oksbi',
    slotRange: 'Slots 1–5 (8:00 PM – 9:40 PM)',
  },
  SRISHTI: {
    name: 'Srishti Sarkar',
    upiId: 'srishti.sarkar007@okhdfcbank',
    slotRange: 'Slots 6–10 (9:40 PM – 11:20 PM)',
  },
  TANVEE: {
    name: 'Tanvee Goenka',
    upiId: 'goenka.tanvee@okaxis',
    slotRange: 'Slots 11–15 (11:20 PM – 1:00 AM)',
  },
  SOLO: {
    name: 'Hriday Goyal',
    upiId: 'hridaygoyal2000@oksbi',
    slotRange: 'Solo Matchmaking Pool',
  },
};

export const SLOT_SCHEDULE = [
  // 1-5: Hriday
  { num: 1, start: '20:00', end: '20:20', ...UPI_CONFIG.HRIDAY },
  { num: 2, start: '20:20', end: '20:40', ...UPI_CONFIG.HRIDAY },
  { num: 3, start: '20:40', end: '21:00', ...UPI_CONFIG.HRIDAY },
  { num: 4, start: '21:00', end: '21:20', ...UPI_CONFIG.HRIDAY },
  { num: 5, start: '21:20', end: '21:40', ...UPI_CONFIG.HRIDAY },

  // 6-10: Srishti
  { num: 6, start: '21:40', end: '22:00', ...UPI_CONFIG.SRISHTI },
  { num: 7, start: '22:00', end: '22:20', ...UPI_CONFIG.SRISHTI },
  { num: 8, start: '22:20', end: '22:40', ...UPI_CONFIG.SRISHTI },
  { num: 9, start: '22:40', end: '23:00', ...UPI_CONFIG.SRISHTI },
  { num: 10, start: '23:00', end: '23:20', ...UPI_CONFIG.SRISHTI },

  // 11-15: Tanvee
  { num: 11, start: '23:20', end: '23:40', ...UPI_CONFIG.TANVEE },
  { num: 12, start: '23:40', end: '00:00', ...UPI_CONFIG.TANVEE },
  { num: 13, start: '00:00', end: '00:20', ...UPI_CONFIG.TANVEE },
  { num: 14, start: '00:20', end: '00:40', ...UPI_CONFIG.TANVEE },
  { num: 15, start: '00:40', end: '01:00', ...UPI_CONFIG.TANVEE },
];

export function generateSlots() {
  return SLOT_SCHEDULE.map(s => ({
    slot_id: `2026-10-22|${s.start}`,
    start_time: s.start,
    end_time: s.end,
    slot_number: s.num,
    merchant_name: s.name,
    merchant_upi: s.upiId,
  }));
}

async function main() {
  console.log('--- Seeding Laser Tag 15 Continuous Slots (8 PM - 1 AM) with Rotating UPI Accounts ---');

  await execute(`
    CREATE TABLE IF NOT EXISTS laser_tag_slots (
      slot_id TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      merchant_name TEXT NOT NULL,
      merchant_upi TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS laser_tag_registrations (
      registration_id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL REFERENCES laser_tag_slots(slot_id),
      team TEXT NOT NULL CHECK (team IN ('Team A', 'Team B', 'Solo Pool')),
      captain_name TEXT NOT NULL,
      captain_email TEXT NOT NULL,
      captain_phone TEXT NOT NULL,
      player_count INTEGER NOT NULL CHECK (player_count BETWEEN 1 AND 4),
      total_fee INTEGER NOT NULL,
      upi_payload TEXT NOT NULL,
      utr_reference TEXT,
      screenshot_url TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (payment_status IN ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED')),
      booking_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (booking_status IN ('PENDING_APPROVAL', 'CONFIRMED', 'REJECTED')),
      admin_note TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      registration_type TEXT DEFAULT 'GROUP' CHECK (registration_type IN ('GROUP', 'SOLO')),
      preferred_slot_id TEXT
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS laser_tag_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id TEXT NOT NULL REFERENCES laser_tag_registrations(registration_id) ON DELETE CASCADE,
      player_number INTEGER NOT NULL CHECK (player_number BETWEEN 1 AND 4),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL
    )
  `);

  await execute(`CREATE INDEX IF NOT EXISTS idx_laser_tag_reg_slot_team ON laser_tag_registrations(slot_id, team, booking_status)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_laser_tag_reg_type ON laser_tag_registrations(registration_type, booking_status)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_laser_tag_players_reg ON laser_tag_players(registration_id)`);

  const slots = generateSlots();
  for (const s of slots) {
    await execute(
      'INSERT OR REPLACE INTO laser_tag_slots (slot_id, start_time, end_time, slot_number, merchant_name, merchant_upi) VALUES (?, ?, ?, ?, ?, ?)',
      [s.slot_id, s.start_time, s.end_time, s.slot_number, s.merchant_name, s.merchant_upi]
    );
  }

  // Insert solo placeholder slot
  await execute(
    'INSERT OR REPLACE INTO laser_tag_slots (slot_id, start_time, end_time, slot_number, merchant_name, merchant_upi) VALUES (?, ?, ?, ?, ?, ?)',
    ['2026-10-22|SOLO_POOL', '20:00', '01:00', 0, 'Hriday Goyal', 'hridaygoyal2000@oksbi']
  );

  const countRes = await execute('SELECT COUNT(*) as count FROM laser_tag_slots WHERE slot_number > 0');
  console.log(`Success! Total slots in laser_tag_slots: ${countRes.rows[0][0].value}`);
}

if (process.argv[1] && process.argv[1].endsWith('seed_laser_tag.js')) {
  main().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
