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

export function generateSlots() {
  const slots = [];
  let currentHour = 18;
  let currentMin = 0;

  for (let i = 0; i < 36; i++) {
    const startH = String(currentHour).padStart(2, '0');
    const startM = String(currentMin).padStart(2, '0');
    const startTime = `${startH}:${startM}`;

    let nextMin = currentMin + 10;
    let nextHour = currentHour;
    if (nextMin === 60) {
      nextMin = 0;
      nextHour = (nextHour + 1) % 24;
    }
    const endH = String(nextHour).padStart(2, '0');
    const endM = String(nextMin).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    const slotId = `2026-10-22|${startTime}`;
    slots.push({ slot_id: slotId, start_time: startTime, end_time: endTime });

    currentHour = nextHour;
    currentMin = nextMin;
  }
  return slots;
}

async function main() {
  console.log('--- Seeding Laser Tag Slots ---');
  // Ensure tables exist
  await execute(`
    CREATE TABLE IF NOT EXISTS laser_tag_slots (
      slot_id TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS laser_tag_registrations (
      registration_id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL REFERENCES laser_tag_slots(slot_id),
      team TEXT NOT NULL CHECK (team IN ('Team A', 'Team B')),
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  const slots = generateSlots();
  for (const s of slots) {
    await execute(
      'INSERT OR IGNORE INTO laser_tag_slots (slot_id, start_time, end_time) VALUES (?, ?, ?)',
      [s.slot_id, s.start_time, s.end_time]
    );
  }

  const countRes = await execute('SELECT COUNT(*) as count FROM laser_tag_slots');
  console.log(`Success! Total slots in laser_tag_slots: ${countRes.rows[0][0].value}`);
}

if (process.argv[1] && process.argv[1].endsWith('seed_laser_tag.js')) {
  main().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
