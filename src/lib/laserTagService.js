import { db } from './db';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// 3 Designated UPI accounts for rotation across 5-slot blocks
export const UPI_ACCOUNTS = {
  HRIDAY: {
    name: 'Hriday Goyal',
    upiId: 'hridaygoyal2000@oksbi',
    slotRange: 'Slots 1–5 (8:00 PM – 9:40 PM)',
    label: 'Slots 1–5',
  },
  SRISHTI: {
    name: 'Srishti Sarkar',
    upiId: 'srishti.sarkar007@okhdfcbank',
    slotRange: 'Slots 6–10 (9:40 PM – 11:20 PM)',
    label: 'Slots 6–10',
  },
  TANVEE: {
    name: 'Tanvee Goenka',
    upiId: 'goenka.tanvee@okaxis',
    slotRange: 'Slots 11–15 (11:20 PM – 1:00 AM)',
    label: 'Slots 11–15',
  },
  SOLO: {
    name: 'Hriday Goyal',
    upiId: 'hridaygoyal2000@oksbi',
    slotRange: 'Solo Matchmaking Pool',
    label: 'Solo Pool',
  },
};

export const DEFAULT_UPI_ID = UPI_ACCOUNTS.HRIDAY.upiId;

export function getUpiConfigForSlot(slotNumber) {
  const num = Number(slotNumber);
  if (num >= 1 && num <= 5) return UPI_ACCOUNTS.HRIDAY;
  if (num >= 6 && num <= 10) return UPI_ACCOUNTS.SRISHTI;
  if (num >= 11 && num <= 15) return UPI_ACCOUNTS.TANVEE;
  return UPI_ACCOUNTS.SOLO;
}

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

// 15 Continuous 20-Minute Slots from 8:00 PM to 1:00 AM on Oct 22, 2026
export const SLOT_SCHEDULE = [
  // 1-5: Hriday Goyal
  { num: 1, start: '20:00', end: '20:20', ...UPI_ACCOUNTS.HRIDAY },
  { num: 2, start: '20:20', end: '20:40', ...UPI_ACCOUNTS.HRIDAY },
  { num: 3, start: '20:40', end: '21:00', ...UPI_ACCOUNTS.HRIDAY },
  { num: 4, start: '21:00', end: '21:20', ...UPI_ACCOUNTS.HRIDAY },
  { num: 5, start: '21:20', end: '21:40', ...UPI_ACCOUNTS.HRIDAY },

  // 6-10: Srishti Sarkar
  { num: 6, start: '21:40', end: '22:00', ...UPI_ACCOUNTS.SRISHTI },
  { num: 7, start: '22:00', end: '22:20', ...UPI_ACCOUNTS.SRISHTI },
  { num: 8, start: '22:20', end: '22:40', ...UPI_ACCOUNTS.SRISHTI },
  { num: 9, start: '22:40', end: '23:00', ...UPI_ACCOUNTS.SRISHTI },
  { num: 10, start: '23:00', end: '23:20', ...UPI_ACCOUNTS.SRISHTI },

  // 11-15: Tanvee Goenka
  { num: 11, start: '23:20', end: '23:40', ...UPI_ACCOUNTS.TANVEE },
  { num: 12, start: '23:40', end: '00:00', ...UPI_ACCOUNTS.TANVEE },
  { num: 13, start: '00:00', end: '00:20', ...UPI_ACCOUNTS.TANVEE },
  { num: 14, start: '00:20', end: '00:40', ...UPI_ACCOUNTS.TANVEE },
  { num: 15, start: '00:40', end: '01:00', ...UPI_ACCOUNTS.TANVEE },
];

export function generateSlotDefinitions() {
  return SLOT_SCHEDULE.map((s) => ({
    slot_id: `2026-10-22|${s.start}`,
    start_time: s.start,
    end_time: s.end,
    slot_number: s.num,
    merchant_name: s.name,
    merchant_upi: s.upiId,
  }));
}

// Ensure schema and all 15 slots exist in Turso
export async function ensureLaserTagSchema() {
  if (!db) return;

  await db.execute(`
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

  await db.execute(`
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
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_laser_tag_reg_type ON laser_tag_registrations(registration_type, booking_status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_laser_tag_players_reg ON laser_tag_players(registration_id)`);

  // Check if slots are seeded
  const countRes = await db.execute('SELECT COUNT(*) as cnt FROM laser_tag_slots WHERE slot_number > 0');
  const count = countRes.rows && countRes.rows[0] ? Number(countRes.rows[0].cnt || countRes.rows[0].count || 0) : 0;
  if (count < 15) {
    const slots = generateSlotDefinitions();
    for (const s of slots) {
      await db.execute(
        'INSERT OR REPLACE INTO laser_tag_slots (slot_id, start_time, end_time, slot_number, merchant_name, merchant_upi) VALUES (?, ?, ?, ?, ?, ?)',
        [s.slot_id, s.start_time, s.end_time, s.slot_number, s.merchant_name, s.merchant_upi]
      );
    }
    // Solo pool placeholder
    await db.execute(
      'INSERT OR REPLACE INTO laser_tag_slots (slot_id, start_time, end_time, slot_number, merchant_name, merchant_upi) VALUES (?, ?, ?, ?, ?, ?)',
      ['2026-10-22|SOLO_POOL', '20:00', '01:00', 0, 'Hriday Goyal', 'hridaygoyal2000@oksbi']
    );
  }
}

// Generate NPCI UPI Deep-Link URI
export function generateUpiPayload({ upiId = DEFAULT_UPI_ID, slotId, team, playerCount }) {
  const amount = (playerCount * 100).toFixed(2);
  const note = `LT ${slotId || 'SOLO'} ${team || 'SOLO'}`;
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Laser%20Tag%20Oct22&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
}

// Upload payment screenshot to Cloudinary, with Base64 fallback if needed
export async function uploadPaymentScreenshot(file) {
  if (!file) throw new Error('No screenshot file provided');
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Screenshot file size exceeds 5 MB limit');
  }

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

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(new Error('Failed to read image file: ' + err.message));
    reader.readAsDataURL(file);
  });
}

// Get all 15 continuous slots with live computed capacities and statuses
export async function getLaserTagSlots() {
  await ensureLaserTagSchema();

  const [slotsRes, regRes] = await Promise.all([
    db.execute('SELECT * FROM laser_tag_slots WHERE slot_number > 0 ORDER BY slot_number ASC'),
    db.execute(`
      SELECT slot_id, team, player_count, booking_status, payment_status, registration_type 
      FROM laser_tag_registrations 
      WHERE booking_status IN ('CONFIRMED', 'PENDING_APPROVAL')
    `),
  ]);

  const rawSlots = slotsRes.rows || [];
  const rawRegs = regRes.rows || [];

  // Group active bookings by `${slot_id}__${team}`
  const heldMap = {};
  rawRegs.forEach((reg) => {
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

  return rawSlots.map((slot) => {
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

    const slotNum = Number(slot.slot_number);
    let hourBlock = 'ALL';
    if (slotNum <= 3) hourBlock = '20'; // 8-9 PM
    else if (slotNum <= 6) hourBlock = '21'; // 9-10 PM
    else if (slotNum <= 9) hourBlock = '22'; // 10-11 PM
    else if (slotNum <= 12) hourBlock = '23'; // 11 PM - 12 AM
    else hourBlock = '00'; // 12-1 AM

    const upiConfig = getUpiConfigForSlot(slotNum);

    return {
      slot_id: slot.slot_id,
      slot_number: slotNum,
      start_time: slot.start_time,
      end_time: slot.end_time,
      time_window: formatSlotTimeWindow(slot.start_time, slot.end_time),
      hour_block: hourBlock,
      merchant_name: slot.merchant_name || upiConfig.name,
      merchant_upi: slot.merchant_upi || upiConfig.upiId,
      merchant_range: upiConfig.slotRange,
      team_a: {
        name: 'Team A',
        max_spots: 4,
        confirmed_players: aConfirmed,
        pending_players: aPending,
        total_held: aTotalHeld,
        spots_left: aSpotsLeft,
        status: aStatus,
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

// Concurrency-safe Group Registration (STRICTLY 3 OR 4 PLAYERS)
export async function registerLaserTagGroup({
  slotId,
  team,
  players,
  utrReference = '',
  screenshotFile = null,
  screenshotUrl = null,
}) {
  await ensureLaserTagSchema();

  if (!slotId) throw new Error('Slot ID is required');
  if (team !== 'Team A' && team !== 'Team B') throw new Error('Invalid team. Must be Team A or Team B');
  if (!Array.isArray(players) || (players.length !== 3 && players.length !== 4)) {
    throw new Error('Group registration is strictly for 3 or 4 players.');
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

  // Find slot to look up the designated UPI ID for this 5-slot block
  const slotRes = await db.execute('SELECT * FROM laser_tag_slots WHERE slot_id = ?', [slotId]);
  const slotRow = slotRes.rows?.[0];
  const slotNum = slotRow ? Number(slotRow.slot_number) : 1;
  const upiConfig = getUpiConfigForSlot(slotNum);
  const upiPayload = generateUpiPayload({ upiId: upiConfig.upiId, slotId, team, playerCount });

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
      remaining >= 3
        ? `Capacity limit exceeded: Only ${remaining} spot(s) remaining for ${team} in this slot. Need ${playerCount}.`
        : `This slot for ${team} does not have enough spots left for a ${playerCount}-player squad (${remaining} left). Please choose another slot.`
    );
  }

  // Generate unique registration ID
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timeSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const registrationId = `LT-GRP-${timeSuffix}${randomSuffix}`;

  await db.execute(
    `INSERT INTO laser_tag_registrations (
      registration_id, slot_id, team, captain_name, captain_email, captain_phone,
      player_count, total_fee, upi_payload, utr_reference, screenshot_url,
      payment_status, booking_status, registration_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_VERIFICATION', 'PENDING_APPROVAL', 'GROUP')`,
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
    merchant_name: upiConfig.name,
    merchant_upi: upiConfig.upiId,
    utr_reference: utrReference ? utrReference.trim() : null,
    screenshot_url: finalScreenshotUrl,
    payment_status: 'PENDING_VERIFICATION',
    booking_status: 'PENDING_APPROVAL',
    registration_type: 'GROUP',
    players: players.map((p, idx) => ({
      player_number: idx + 1,
      name: p.name.trim(),
      email: p.email.trim(),
      phone: p.phone.trim(),
    })),
  };
}

// Solo Registration (Pool / Matchmaking)
export async function registerLaserTagSolo({
  name,
  email,
  phone,
  preferredSlotId = '2026-10-22|SOLO_POOL',
  utrReference = '',
  screenshotFile = null,
  screenshotUrl = null,
}) {
  await ensureLaserTagSchema();

  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    throw new Error('Name, email, and phone number are required for solo registration.');
  }

  let finalScreenshotUrl = screenshotUrl;
  if (!finalScreenshotUrl) {
    if (!screenshotFile) {
      throw new Error('Payment screenshot is required to complete solo registration.');
    }
    finalScreenshotUrl = await uploadPaymentScreenshot(screenshotFile);
  }

  const playerCount = 1;
  const totalFee = 100;
  const upiConfig = UPI_ACCOUNTS.SOLO;
  const upiPayload = generateUpiPayload({
    upiId: upiConfig.upiId,
    slotId: preferredSlotId,
    team: 'Solo Pool',
    playerCount: 1,
  });

  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timeSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const registrationId = `LT-SOLO-${timeSuffix}${randomSuffix}`;

  await db.execute(
    `INSERT INTO laser_tag_registrations (
      registration_id, slot_id, team, captain_name, captain_email, captain_phone,
      player_count, total_fee, upi_payload, utr_reference, screenshot_url,
      payment_status, booking_status, registration_type, preferred_slot_id
    ) VALUES (?, ?, 'Solo Pool', ?, ?, ?, 1, 100, ?, ?, ?, 'PENDING_VERIFICATION', 'PENDING_APPROVAL', 'SOLO', ?)`,
    [
      registrationId,
      preferredSlotId || '2026-10-22|SOLO_POOL',
      name.trim(),
      email.trim(),
      phone.trim(),
      upiPayload,
      utrReference ? utrReference.trim() : null,
      finalScreenshotUrl,
      preferredSlotId || '2026-10-22|SOLO_POOL',
    ]
  );

  await db.execute(
    `INSERT INTO laser_tag_players (registration_id, player_number, name, email, phone) 
     VALUES (?, 1, ?, ?, ?)`,
    [registrationId, name.trim(), email.trim(), phone.trim()]
  );

  return {
    registration_id: registrationId,
    slot_id: preferredSlotId,
    team: 'Solo Pool',
    captain_name: name.trim(),
    captain_email: email.trim(),
    captain_phone: phone.trim(),
    player_count: 1,
    total_fee: 100,
    upi_payload: upiPayload,
    merchant_name: upiConfig.name,
    merchant_upi: upiConfig.upiId,
    utr_reference: utrReference ? utrReference.trim() : null,
    screenshot_url: finalScreenshotUrl,
    payment_status: 'PENDING_VERIFICATION',
    booking_status: 'PENDING_APPROVAL',
    registration_type: 'SOLO',
    preferred_slot_id: preferredSlotId,
    players: [{ player_number: 1, name: name.trim(), email: email.trim(), phone: phone.trim() }],
  };
}

// Backward-compatible alias
export const registerLaserTagSlot = registerLaserTagGroup;

// Admin queue fetching with summary KPIs
export async function getLaserTagRegistrations(filter = 'ALL') {
  await ensureLaserTagSchema();

  let query = `
    SELECT r.*, s.start_time, s.end_time, s.slot_number, s.merchant_name 
    FROM laser_tag_registrations r
    LEFT JOIN laser_tag_slots s ON r.slot_id = s.slot_id
  `;
  const args = [];

  if (filter === 'PENDING_VERIFICATION') {
    query += ` WHERE r.payment_status = 'PENDING_VERIFICATION'`;
  } else if (filter === 'APPROVED') {
    query += ` WHERE r.payment_status = 'APPROVED'`;
  } else if (filter === 'REJECTED') {
    query += ` WHERE r.payment_status = 'REJECTED'`;
  } else if (filter === 'SOLO') {
    query += ` WHERE r.registration_type = 'SOLO'`;
  } else if (filter === 'GROUP') {
    query += ` WHERE r.registration_type = 'GROUP'`;
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
        SUM(CASE WHEN payment_status = 'PENDING_VERIFICATION' THEN total_fee ELSE 0 END) as pending_revenue,
        SUM(CASE WHEN registration_type = 'SOLO' THEN 1 ELSE 0 END) as total_solo
      FROM laser_tag_registrations
    `),
  ]);

  const rawRegs = regsRes.rows || [];
  const rawPlayers = playersRes.rows || [];
  const statsRow = allStatsRes.rows?.[0] || {};

  const playerMap = {};
  rawPlayers.forEach((p) => {
    if (!playerMap[p.registration_id]) playerMap[p.registration_id] = [];
    playerMap[p.registration_id].push(p);
  });

  const registrations = rawRegs.map((r) => ({
    ...r,
    time_window: r.start_time && r.end_time ? formatSlotTimeWindow(r.start_time, r.end_time) : 'Solo Matchmaking Pool',
    players: playerMap[r.registration_id] || [],
  }));

  const kpis = {
    totalSlots: 15,
    confirmedPlayers: Number(statsRow.confirmed_players || 0),
    pendingPlayers: Number(statsRow.pending_players || 0),
    approvedRevenue: Number(statsRow.approved_revenue || 0),
    pendingRevenue: Number(statsRow.pending_revenue || 0),
    totalSolo: Number(statsRow.total_solo || 0),
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

// Admin assign solo player to a specific slot and team
export async function assignSoloPlayerToSlot(registrationId, { targetSlotId, targetTeam }) {
  await ensureLaserTagSchema();

  if (!targetSlotId || !targetTeam) {
    throw new Error('Target Slot ID and Team (Team A or Team B) are required.');
  }

  await db.execute(
    `UPDATE laser_tag_registrations 
     SET slot_id = ?, team = ? 
     WHERE registration_id = ?`,
    [targetSlotId, targetTeam, registrationId]
  );

  const res = await db.execute(
    'SELECT * FROM laser_tag_registrations WHERE registration_id = ?',
    [registrationId]
  );
  return res.rows?.[0] || null;
}

// Lookup registration by Registration ID, Captain Email, or Phone
export async function lookupLaserTagRegistration(searchTerm) {
  await ensureLaserTagSchema();
  if (!searchTerm?.trim()) return [];

  const term = searchTerm.trim();
  const res = await db.execute(
    `SELECT r.*, s.start_time, s.end_time 
     FROM laser_tag_registrations r
     LEFT JOIN laser_tag_slots s ON r.slot_id = s.slot_id
     WHERE r.registration_id = ? OR LOWER(r.captain_email) = LOWER(?) OR r.captain_phone = ?
     ORDER BY r.created_at DESC`,
    [term, term, term]
  );

  const regs = res.rows || [];
  if (regs.length === 0) return [];

  const regIds = regs.map((r) => r.registration_id);
  const playersRes = await db.execute(
    `SELECT * FROM laser_tag_players WHERE registration_id IN (${regIds.map(() => '?').join(',')}) ORDER BY player_number ASC`,
    regIds
  );

  const playerMap = {};
  (playersRes.rows || []).forEach((p) => {
    if (!playerMap[p.registration_id]) playerMap[p.registration_id] = [];
    playerMap[p.registration_id].push(p);
  });

  return regs.map((r) => ({
    ...r,
    time_window: r.start_time && r.end_time ? formatSlotTimeWindow(r.start_time, r.end_time) : 'Solo Matchmaking Pool',
    players: playerMap[r.registration_id] || [],
  }));
}
