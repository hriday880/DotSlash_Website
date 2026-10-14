import { db } from './db';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
export const DEFAULT_UPI_ID = import.meta.env.VITE_LASER_TAG_UPI_ID || 'hridaygoyal2000@oksbi';

// 12-hour format converter
export function formatTime12h(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
  if (h === 0 || h === 24) {
    h = 12;
  } else if (h > 12) {
    h = h - 12;
  }
  return `${h}:${m} ${ampm}`;
}

export function formatSlotTimeWindow(startTime, endTime) {
  return `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
}

// Generate the 36 continuous 10-minute slots from 18:00 to 00:00 on Oct 22, 2026
export function generateSlotDefinitions() {
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

// Ensure schema and all 36 slots exist in Turso
export async function ensureLaserTagSchema() {
  if (!db) return;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS laser_tag_slots (
      slot_id TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS laser_tag_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id TEXT NOT NULL REFERENCES laser_tag_registrations(registration_id) ON DELETE CASCADE,
      player_number INTEGER NOT NULL CHECK (player_number BETWEEN 1 AND 4),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_laser_tag_reg_slot_team ON laser_tag_registrations(slot_id, team, booking_status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_laser_tag_players_reg ON laser_tag_players(registration_id)`);

  // Check if slots are seeded
  const countRes = await db.execute('SELECT COUNT(*) as cnt FROM laser_tag_slots');
  const count = countRes.rows && countRes.rows[0] ? Number(countRes.rows[0].cnt || countRes.rows[0].count || 0) : 0;
  if (count < 36) {
    const slots = generateSlotDefinitions();
    for (const s of slots) {
      await db.execute(
        'INSERT OR IGNORE INTO laser_tag_slots (slot_id, start_time, end_time) VALUES (?, ?, ?)',
        [s.slot_id, s.start_time, s.end_time]
      );
    }
  }
}

// Generate NPCI UPI Deep-Link URI
export function generateUpiPayload({ upiId = DEFAULT_UPI_ID, slotId, team, playerCount }) {
  const amount = (playerCount * 100).toFixed(2);
  const note = `LT ${slotId} ${team}`;
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Laser%20Tag%20Oct22&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
}

// Upload payment screenshot to Cloudinary, with Base64 fallback if needed
export async function uploadPaymentScreenshot(file) {
  if (!file) throw new Error('No screenshot file provided');
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Screenshot file size exceeds 5 MB limit');
  }

  // Attempt Cloudinary upload if config is present
  if (CLOUD_NAME && UPLOAD_PRESET) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.secure_url) return data.secure_url;
      }
    } catch (e) {
      console.warn('Cloudinary upload failed, falling back to base64 DataURL:', e);
    }
  }

  // Fallback: Read as base64 DataURL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(new Error('Failed to read image file: ' + err.message));
    reader.readAsDataURL(file);
  });
}

// Get all 36 slots with live computed capacities and statuses
export async function getLaserTagSlots() {
  await ensureLaserTagSchema();

  const [slotsRes, regRes] = await Promise.all([
    db.execute('SELECT * FROM laser_tag_slots ORDER BY slot_id ASC'),
    db.execute(`
      SELECT slot_id, team, player_count, booking_status, payment_status 
      FROM laser_tag_registrations 
      WHERE booking_status IN ('CONFIRMED', 'PENDING_APPROVAL')
    `),
  ]);

  const rawSlots = slotsRes.rows || [];
  const rawRegs = regRes.rows || [];

  // Group active bookings by `${slot_id}__${team}`
  const heldMap = {};
  rawRegs.forEach(reg => {
    const key = `${reg.slot_id}__${reg.team}`;
    if (!heldMap[key]) {
      heldMap[key] = { confirmed: 0, pending: 0 };
    }
    const count = Number(reg.player_count) || 0;
    if (reg.booking_status === 'CONFIRMED') {
      heldMap[key].confirmed += count;
    } else if (reg.booking_status === 'PENDING_APPROVAL') {
      heldMap[key].pending += count;
    }
  });

  return rawSlots.map(slot => {
    const keyA = `${slot.slot_id}__Team A`;
    const keyB = `${slot.slot_id}__Team B`;

    const aHeld = heldMap[keyA] || { confirmed: 0, pending: 0 };
    const bHeld = heldMap[keyB] || { confirmed: 0, pending: 0 };

    const aConfirmed = Math.min(4, aHeld.confirmed);
    const aPending = Math.min(4 - aConfirmed, aHeld.pending);
    const aTotalHeld = aConfirmed + aPending;
    const aSpotsLeft = Math.max(0, 4 - aTotalHeld);

    let aStatus = 'AVAILABLE';
    if (aConfirmed >= 4) {
      aStatus = 'FULL';
    } else if (aTotalHeld >= 4) {
      aStatus = 'PENDING_APPROVAL';
    } else if (aTotalHeld > 0) {
      aStatus = 'OPEN';
    }

    const bConfirmed = Math.min(4, bHeld.confirmed);
    const bPending = Math.min(4 - bConfirmed, bHeld.pending);
    const bTotalHeld = bConfirmed + bPending;
    const bSpotsLeft = Math.max(0, 4 - bTotalHeld);

    let bStatus = 'AVAILABLE';
    if (bConfirmed >= 4) {
      bStatus = 'FULL';
    } else if (bTotalHeld >= 4) {
      bStatus = 'PENDING_APPROVAL';
    } else if (bTotalHeld > 0) {
      bStatus = 'OPEN';
    }

    // Determine hour block for filtering
    const startHour = parseInt(slot.start_time.split(':')[0], 10);
    let hourBlock = 'other';
    if (startHour === 18) hourBlock = '18';
    else if (startHour === 19) hourBlock = '19';
    else if (startHour === 20) hourBlock = '20';
    else if (startHour === 21) hourBlock = '21';
    else if (startHour === 22) hourBlock = '22';
    else if (startHour === 23) hourBlock = '23';

    return {
      slot_id: slot.slot_id,
      start_time: slot.start_time,
      end_time: slot.end_time,
      time_window: formatSlotTimeWindow(slot.start_time, slot.end_time),
      hour_block: hourBlock,
      team_a: {
        name: 'Team A',
        max_spots: 4,
        confirmed_players: aConfirmed,
        pending_players: aPending,
        total_held: aTotalHeld,
        spots_left: aSpotsLeft,
        status: aStatus, // 'AVAILABLE' | 'OPEN' | 'PENDING_APPROVAL' | 'FULL'
      },
      team_b: {
        name: 'Team B',
        max_spots: 4,
        confirmed_players: bConfirmed,
        pending_players: bPending,
        total_held: bTotalHeld,
        spots_left: bSpotsLeft,
        status: bStatus,
      },
    };
  });
}

// Concurrency-safe slot registration
export async function registerLaserTagSlot({
  slotId,
  team,
  players,
  utrReference = '',
  screenshotFile = null,
  screenshotUrl = null,
  upiId = DEFAULT_UPI_ID,
}) {
  await ensureLaserTagSchema();

  if (!slotId) throw new Error('Slot ID is required');
  if (team !== 'Team A' && team !== 'Team B') throw new Error('Invalid team. Must be Team A or Team B');
  if (!Array.isArray(players) || players.length < 1 || players.length > 4) {
    throw new Error('Group registration must be between 1 and 4 players');
  }

  // Validate Player 1 (Captain)
  const captain = players[0];
  if (!captain.name?.trim() || !captain.email?.trim() || !captain.phone?.trim()) {
    throw new Error('Squad Captain (Player 1) name, email, and phone number are required');
  }

  // Validate subsequent players
  for (let i = 1; i < players.length; i++) {
    const p = players[i];
    if (!p.name?.trim() || !p.email?.trim() || !p.phone?.trim()) {
      throw new Error(`Player ${i + 1} name, email, and phone number are required`);
    }
  }

  // Validate screenshot
  let finalScreenshotUrl = screenshotUrl;
  if (!finalScreenshotUrl) {
    if (!screenshotFile) {
      throw new Error('Payment screenshot is required to complete registration');
    }
    finalScreenshotUrl = await uploadPaymentScreenshot(screenshotFile);
  }

  const playerCount = players.length;
  const totalFee = playerCount * 100;
  const upiPayload = generateUpiPayload({ upiId, slotId, team, playerCount });

  // Concurrency check: query currently held spots on the target slot & team
  const checkRes = await db.execute(
    `SELECT SUM(player_count) as total_held 
     FROM laser_tag_registrations 
     WHERE slot_id = ? AND team = ? AND booking_status IN ('CONFIRMED', 'PENDING_APPROVAL')`,
    [slotId, team]
  );

  const currentHeld = Number(checkRes.rows?.[0]?.total_held || 0);
  const remaining = 4 - currentHeld;

  if (playerCount > remaining) {
    throw new Error(
      remaining > 0
        ? `Capacity limit exceeded: Only ${remaining} spot(s) remaining for ${team} in this slot.`
        : `This slot for ${team} is currently full or pending verification. Please select another slot.`
    );
  }

  // Generate unique registration ID: LT-YYYYMMDD-XXXX
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timeSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const registrationId = `LT-OCT22-${timeSuffix}${randomSuffix}`;

  // Insert registration row
  await db.execute(
    `INSERT INTO laser_tag_registrations (
      registration_id, slot_id, team, captain_name, captain_email, captain_phone,
      player_count, total_fee, upi_payload, utr_reference, screenshot_url,
      payment_status, booking_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_VERIFICATION', 'PENDING_APPROVAL')`,
    [
      registrationId,
      slotId,
      team,
      captain.name.trim(),
      captain.email.trim(),
      captain.phone.trim(),
      playerCount,
      totalFee,
      upiPayload,
      utrReference ? utrReference.trim() : null,
      finalScreenshotUrl,
    ]
  );

  // Insert players
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    await db.execute(
      `INSERT INTO laser_tag_players (registration_id, player_number, name, email, phone) 
       VALUES (?, ?, ?, ?, ?)`,
      [registrationId, i + 1, p.name.trim(), p.email.trim(), p.phone.trim()]
    );
  }

  return {
    registration_id: registrationId,
    slot_id: slotId,
    team,
    captain_name: captain.name.trim(),
    captain_email: captain.email.trim(),
    captain_phone: captain.phone.trim(),
    player_count: playerCount,
    total_fee: totalFee,
    upi_payload: upiPayload,
    utr_reference: utrReference ? utrReference.trim() : null,
    screenshot_url: finalScreenshotUrl,
    payment_status: 'PENDING_VERIFICATION',
    booking_status: 'PENDING_APPROVAL',
    players: players.map((p, idx) => ({
      player_number: idx + 1,
      name: p.name.trim(),
      email: p.email.trim(),
      phone: p.phone.trim(),
    })),
  };
}

// Admin queue fetching with summary KPIs
export async function getLaserTagRegistrations(filter = 'ALL') {
  await ensureLaserTagSchema();

  let query = `
    SELECT r.*, s.start_time, s.end_time 
    FROM laser_tag_registrations r
    JOIN laser_tag_slots s ON r.slot_id = s.slot_id
  `;
  const args = [];

  if (filter === 'PENDING_VERIFICATION') {
    query += ` WHERE r.payment_status = 'PENDING_VERIFICATION'`;
  } else if (filter === 'APPROVED') {
    query += ` WHERE r.payment_status = 'APPROVED'`;
  } else if (filter === 'REJECTED') {
    query += ` WHERE r.payment_status = 'REJECTED'`;
  }

  query += ` ORDER BY r.created_at DESC`;

  const [regsRes, playersRes, allStatsRes] = await Promise.all([
    db.execute(query, args),
    db.execute('SELECT * FROM laser_tag_players ORDER BY registration_id, player_number ASC'),
    db.execute(`
      SELECT 
        SUM(CASE WHEN booking_status = 'CONFIRMED' THEN player_count ELSE 0 END) as confirmed_players,
        SUM(CASE WHEN booking_status = 'PENDING_APPROVAL' THEN player_count ELSE 0 END) as pending_players,
        SUM(CASE WHEN payment_status = 'APPROVED' THEN total_fee ELSE 0 END) as approved_revenue,
        SUM(CASE WHEN payment_status = 'PENDING_VERIFICATION' THEN total_fee ELSE 0 END) as pending_revenue
      FROM laser_tag_registrations
    `),
  ]);

  const rawRegs = regsRes.rows || [];
  const rawPlayers = playersRes.rows || [];
  const statsRow = allStatsRes.rows?.[0] || {};

  // Group players by registration_id
  const playerMap = {};
  rawPlayers.forEach(p => {
    if (!playerMap[p.registration_id]) playerMap[p.registration_id] = [];
    playerMap[p.registration_id].push(p);
  });

  const registrations = rawRegs.map(r => ({
    ...r,
    time_window: formatSlotTimeWindow(r.start_time, r.end_time),
    players: playerMap[r.registration_id] || [],
  }));

  const kpis = {
    totalSlots: 36,
    confirmedPlayers: Number(statsRow.confirmed_players || 0),
    pendingPlayers: Number(statsRow.pending_players || 0),
    approvedRevenue: Number(statsRow.approved_revenue || 0),
    pendingRevenue: Number(statsRow.pending_revenue || 0),
  };

  return { registrations, kpis };
}

// Admin approve or reject action
export async function updateLaserTagRegistrationAdmin(registrationId, { action, adminNote = '' }) {
  await ensureLaserTagSchema();

  if (action !== 'APPROVE' && action !== 'REJECT') {
    throw new Error('Invalid action. Must be APPROVE or REJECT');
  }

  const paymentStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const bookingStatus = action === 'APPROVE' ? 'CONFIRMED' : 'REJECTED';

  await db.execute(
    `UPDATE laser_tag_registrations 
     SET payment_status = ?, booking_status = ?, reviewed_at = CURRENT_TIMESTAMP, admin_note = ?
     WHERE registration_id = ?`,
    [paymentStatus, bookingStatus, adminNote || null, registrationId]
  );

  const res = await db.execute(
    'SELECT * FROM laser_tag_registrations WHERE registration_id = ?',
    [registrationId]
  );

  return res.rows?.[0] || null;
}

// Lookup registration by Registration ID or Captain Email / Phone
export async function lookupLaserTagRegistration(searchTerm) {
  await ensureLaserTagSchema();
  if (!searchTerm?.trim()) return [];

  const term = searchTerm.trim();
  const res = await db.execute(
    `SELECT r.*, s.start_time, s.end_time 
     FROM laser_tag_registrations r
     JOIN laser_tag_slots s ON r.slot_id = s.slot_id
     WHERE r.registration_id = ? OR LOWER(r.captain_email) = LOWER(?) OR r.captain_phone = ?
     ORDER BY r.created_at DESC`,
    [term, term, term]
  );

  const regs = res.rows || [];
  if (regs.length === 0) return [];

  const regIds = regs.map(r => r.registration_id);
  const playersRes = await db.execute(
    `SELECT * FROM laser_tag_players WHERE registration_id IN (${regIds.map(() => '?').join(',')}) ORDER BY player_number ASC`,
    regIds
  );

  const playerMap = {};
  (playersRes.rows || []).forEach(p => {
    if (!playerMap[p.registration_id]) playerMap[p.registration_id] = [];
    playerMap[p.registration_id].push(p);
  });

  return regs.map(r => ({
    ...r,
    time_window: formatSlotTimeWindow(r.start_time, r.end_time),
    players: playerMap[r.registration_id] || [],
  }));
}
