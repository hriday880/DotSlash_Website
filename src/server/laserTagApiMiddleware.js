// Vite dev server middleware for Laser Tag API endpoints
// Provides:
//   GET   /api/laser-tag/slots
//   POST  /api/laser-tag/register
//   PATCH /api/laser-tag/admin/registrations/:id
//   GET   /api/laser-tag/admin/registrations
//   GET   /api/laser-tag/lookup

export function createLaserTagApiMiddleware(env) {
  const url = env.VITE_TURSO_DATABASE_URL;
  const token = env.VITE_TURSO_AUTH_TOKEN;
  const upiId = env.VITE_LASER_TAG_UPI_ID || 'hridaygoyal2000@oksbi';

  if (!url || !token) {
    return (req, res, next) => next();
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

    const cols = result.response.result.cols;
    const rawRows = result.response.result.rows;
    return rawRows.map(row => {
      const obj = {};
      cols.forEach((col, i) => {
        const cell = row[i];
        obj[col.name] = cell.type === 'null' ? null : cell.value;
      });
      return obj;
    });
  }

  function formatTime12h(time24) {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
    if (h === 0 || h === 24) h = 12;
    else if (h > 12) h = h - 12;
    return `${h}:${m} ${ampm}`;
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  function sendJson(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }

  return async (req, res, next) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    if (!pathname.startsWith('/api/laser-tag')) {
      return next();
    }

    try {
      // 1. GET /api/laser-tag/slots
      if (req.method === 'GET' && pathname === '/api/laser-tag/slots') {
        const slots = await execute('SELECT * FROM laser_tag_slots WHERE slot_number > 0 ORDER BY slot_number ASC');
        const regs = await execute(`
          SELECT slot_id, team, player_count, booking_status 
          FROM laser_tag_registrations 
          WHERE booking_status IN ('CONFIRMED', 'PENDING_APPROVAL')
        `);

        const heldMap = {};
        regs.forEach(r => {
          const key = `${r.slot_id}__${r.team}`;
          if (!heldMap[key]) heldMap[key] = { confirmed: 0, pending: 0 };
          const cnt = Number(r.player_count) || 0;
          if (r.booking_status === 'CONFIRMED') heldMap[key].confirmed += cnt;
          else if (r.booking_status === 'PENDING_APPROVAL') heldMap[key].pending += cnt;
        });

        const formatted = slots.map(slot => {
          const keyA = `${slot.slot_id}__Team A`;
          const keyB = `${slot.slot_id}__Team B`;

          const aHeld = heldMap[keyA] || { confirmed: 0, pending: 0 };
          const bHeld = heldMap[keyB] || { confirmed: 0, pending: 0 };

          const aConfirmed = Math.min(4, aHeld.confirmed);
          const aPending = Math.min(4 - aConfirmed, aHeld.pending);
          const aTotal = aConfirmed + aPending;
          const aLeft = Math.max(0, 4 - aTotal);
          let aStatus = 'AVAILABLE';
          if (aConfirmed >= 4) aStatus = 'FULL';
          else if (aTotal >= 4) aStatus = 'PENDING_APPROVAL';
          else if (aTotal > 0) aStatus = 'OPEN';

          const bConfirmed = Math.min(4, bHeld.confirmed);
          const bPending = Math.min(4 - bConfirmed, bHeld.pending);
          const bTotal = bConfirmed + bPending;
          const bLeft = Math.max(0, 4 - bTotal);
          let bStatus = 'AVAILABLE';
          if (bConfirmed >= 4) bStatus = 'FULL';
          else if (bTotal >= 4) bStatus = 'PENDING_APPROVAL';
          else if (bTotal > 0) bStatus = 'OPEN';

          const slotNum = Number(slot.slot_number) || 1;
          let hourBlock = 'ALL';
          if (slotNum <= 3) hourBlock = '20'; // 8-9 PM
          else if (slotNum <= 6) hourBlock = '21'; // 9-10 PM
          else if (slotNum <= 9) hourBlock = '22'; // 10-11 PM
          else if (slotNum <= 12) hourBlock = '23'; // 11 PM - 12 AM
          else hourBlock = '00'; // 12-1 AM

          let merchantName = slot.merchant_name;
          let merchantUpi = slot.merchant_upi;
          let merchantRange = 'Slots 1–5';
          if (slotNum <= 5) {
            merchantName = 'Hriday Goyal';
            merchantUpi = 'hridaygoyal2000@oksbi';
            merchantRange = 'Slots 1–5 (8:00 PM – 9:40 PM)';
          } else if (slotNum <= 10) {
            merchantName = 'Srishti Sarkar';
            merchantUpi = 'srishti.sarkar007@okhdfcbank';
            merchantRange = 'Slots 6–10 (9:40 PM – 11:20 PM)';
          } else {
            merchantName = 'Tanvee Goenka';
            merchantUpi = 'goenka.tanvee@okaxis';
            merchantRange = 'Slots 11–15 (11:20 PM – 1:00 AM)';
          }

          return {
            slot_id: slot.slot_id,
            slot_number: slotNum,
            start_time: slot.start_time,
            end_time: slot.end_time,
            time_window: `${formatTime12h(slot.start_time)} – ${formatTime12h(slot.end_time)}`,
            hour_block: hourBlock,
            merchant_name: merchantName,
            merchant_upi: merchantUpi,
            merchant_range: merchantRange,
            team_a: {
              name: 'Team A',
              max_spots: 4,
              confirmed_players: aConfirmed,
              pending_players: aPending,
              spots_left: aLeft,
              status: aStatus,
            },
            team_b: {
              name: 'Team B',
              max_spots: 4,
              confirmed_players: bConfirmed,
              pending_players: bPending,
              spots_left: bLeft,
              status: bStatus,
            },
          };
        });

        return sendJson(res, 200, { success: true, slots: formatted });
      }

      // 2. POST /api/laser-tag/register (GROUP REGISTRATIONS: Strictly 3 or 4 players)
      if (req.method === 'POST' && pathname === '/api/laser-tag/register') {
        const body = await readJsonBody(req);
        const { slotId, team, players, utrReference, screenshotUrl } = body;

        if (!slotId || !team || !Array.isArray(players) || (players.length !== 3 && players.length !== 4)) {
          return sendJson(res, 400, { error: 'Group registration is strictly for 3 or 4 players' });
        }
        if (!screenshotUrl) {
          return sendJson(res, 400, { error: 'Payment screenshot is mandatory' });
        }

        const captain = players[0];
        if (!captain.name || !captain.email || !captain.phone) {
          return sendJson(res, 400, { error: 'Squad Captain (Player 1) details are required' });
        }

        // Concurrency / Capacity Check
        const checkRows = await execute(
          `SELECT SUM(player_count) as total_held 
           FROM laser_tag_registrations 
           WHERE slot_id = ? AND team = ? AND booking_status IN ('CONFIRMED', 'PENDING_APPROVAL')`,
          [slotId, team]
        );
        const currentHeld = Number(checkRows[0]?.total_held || 0);
        const remaining = 4 - currentHeld;

        if (players.length > remaining) {
          return sendJson(res, 409, {
            error: remaining > 0
              ? `Capacity exceeded: Only ${remaining} spot(s) available for ${team} in this slot.`
              : `This slot for ${team} is currently full or pending verification.`
          });
        }

        // Get merchant UPI for slot
        const slotRows = await execute('SELECT slot_number, merchant_name, merchant_upi FROM laser_tag_slots WHERE slot_id = ?', [slotId]);
        const slotNum = Number(slotRows[0]?.slot_number || 1);
        let targetUpi = 'hridaygoyal2000@oksbi';
        if (slotNum >= 6 && slotNum <= 10) targetUpi = 'srishti.sarkar007@okhdfcbank';
        else if (slotNum >= 11 && slotNum <= 15) targetUpi = 'goenka.tanvee@okaxis';

        const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
        const timeSuffix = Date.now().toString(36).slice(-4).toUpperCase();
        const registrationId = `LT-GRP-${timeSuffix}${randomSuffix}`;
        const playerCount = players.length;
        const totalFee = playerCount * 100;
        const note = `LT ${slotId} ${team}`;
        const upiPayload = `upi://pay?pa=${encodeURIComponent(targetUpi)}&pn=Laser%20Tag%20Oct22&am=${totalFee}.00&cu=INR&tn=${encodeURIComponent(note)}`;

        await execute(
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
            screenshotUrl,
          ]
        );

        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          await execute(
            `INSERT INTO laser_tag_players (registration_id, player_number, name, email, phone) 
             VALUES (?, ?, ?, ?, ?)`,
            [registrationId, i + 1, p.name.trim(), p.email.trim(), p.phone.trim()]
          );
        }

        return sendJson(res, 201, {
          success: true,
          registration: {
            registration_id: registrationId,
            slot_id: slotId,
            team,
            captain_name: captain.name,
            captain_email: captain.email,
            captain_phone: captain.phone,
            player_count: playerCount,
            total_fee: totalFee,
            upi_payload: upiPayload,
            utr_reference: utrReference || null,
            screenshot_url: screenshotUrl,
            payment_status: 'PENDING_VERIFICATION',
            booking_status: 'PENDING_APPROVAL',
            registration_type: 'GROUP',
            players,
          }
        });
      }

      // 2b. POST /api/laser-tag/register-solo (SOLO POOL REGISTRATIONS)
      if (req.method === 'POST' && pathname === '/api/laser-tag/register-solo') {
        const body = await readJsonBody(req);
        const { name, email, phone, preferredSlotId, utrReference, screenshotUrl } = body;

        if (!name?.trim() || !email?.trim() || !phone?.trim()) {
          return sendJson(res, 400, { error: 'Name, email, and phone number are required for solo registration' });
        }
        if (!screenshotUrl) {
          return sendJson(res, 400, { error: 'Payment screenshot is mandatory' });
        }

        const soloUpi = 'hridaygoyal2000@oksbi';
        const targetSlot = preferredSlotId || '2026-10-22|SOLO_POOL';
        const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
        const timeSuffix = Date.now().toString(36).slice(-4).toUpperCase();
        const registrationId = `LT-SOLO-${timeSuffix}${randomSuffix}`;
        const totalFee = 100;
        const note = `LT SOLO ${targetSlot}`;
        const upiPayload = `upi://pay?pa=${encodeURIComponent(soloUpi)}&pn=Laser%20Tag%20Oct22&am=100.00&cu=INR&tn=${encodeURIComponent(note)}`;

        await execute(
          `INSERT INTO laser_tag_registrations (
            registration_id, slot_id, team, captain_name, captain_email, captain_phone,
            player_count, total_fee, upi_payload, utr_reference, screenshot_url,
            payment_status, booking_status, registration_type, preferred_slot_id
          ) VALUES (?, ?, 'Solo Pool', ?, ?, ?, 1, 100, ?, ?, ?, 'PENDING_VERIFICATION', 'PENDING_APPROVAL', 'SOLO', ?)`,
          [
            registrationId,
            targetSlot,
            name.trim(),
            email.trim(),
            phone.trim(),
            upiPayload,
            utrReference ? utrReference.trim() : null,
            screenshotUrl,
            targetSlot,
          ]
        );

        await execute(
          `INSERT INTO laser_tag_players (registration_id, player_number, name, email, phone) 
           VALUES (?, 1, ?, ?, ?)`,
          [registrationId, name.trim(), email.trim(), phone.trim()]
        );

        return sendJson(res, 201, {
          success: true,
          registration: {
            registration_id: registrationId,
            slot_id: targetSlot,
            team: 'Solo Pool',
            captain_name: name.trim(),
            captain_email: email.trim(),
            captain_phone: phone.trim(),
            player_count: 1,
            total_fee: 100,
            upi_payload: upiPayload,
            utr_reference: utrReference || null,
            screenshot_url: screenshotUrl,
            payment_status: 'PENDING_VERIFICATION',
            booking_status: 'PENDING_APPROVAL',
            registration_type: 'SOLO',
            preferred_slot_id: targetSlot,
            players: [{ player_number: 1, name: name.trim(), email: email.trim(), phone: phone.trim() }],
          }
        });
      }

      // 3. PATCH /api/laser-tag/admin/registrations/:id
      const matchPatch = pathname.match(/^\/api\/laser-tag\/admin\/registrations\/([^/]+)$/);
      if (req.method === 'PATCH' && matchPatch) {
        const id = decodeURIComponent(matchPatch[1]);
        const body = await readJsonBody(req);
        const { action, adminNote } = body;

        if (action !== 'APPROVE' && action !== 'REJECT') {
          return sendJson(res, 400, { error: 'Action must be APPROVE or REJECT' });
        }

        const paymentStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        const bookingStatus = action === 'APPROVE' ? 'CONFIRMED' : 'REJECTED';

        await execute(
          `UPDATE laser_tag_registrations 
           SET payment_status = ?, booking_status = ?, reviewed_at = CURRENT_TIMESTAMP, admin_note = ?
           WHERE registration_id = ?`,
          [paymentStatus, bookingStatus, adminNote || null, id]
        );

        const updated = await execute('SELECT * FROM laser_tag_registrations WHERE registration_id = ?', [id]);
        return sendJson(res, 200, { success: true, registration: updated[0] || null });
      }

      // 3b. PATCH /api/laser-tag/admin/assign-solo
      if (req.method === 'PATCH' && pathname === '/api/laser-tag/admin/assign-solo') {
        const body = await readJsonBody(req);
        const { registrationId, targetSlotId, targetTeam } = body;

        if (!registrationId || !targetSlotId || !targetTeam) {
          return sendJson(res, 400, { error: 'Registration ID, Target Slot ID, and Target Team are required' });
        }

        await execute(
          `UPDATE laser_tag_registrations 
           SET slot_id = ?, team = ? 
           WHERE registration_id = ?`,
          [targetSlotId, targetTeam, registrationId]
        );

        const updated = await execute('SELECT * FROM laser_tag_registrations WHERE registration_id = ?', [registrationId]);
        return sendJson(res, 200, { success: true, registration: updated[0] || null });
      }

      // 4. GET /api/laser-tag/admin/registrations
      if (req.method === 'GET' && pathname === '/api/laser-tag/admin/registrations') {
        const filter = parsedUrl.searchParams.get('status') || 'ALL';
        let q = `
          SELECT r.*, s.start_time, s.end_time, s.slot_number, s.merchant_name 
          FROM laser_tag_registrations r
          LEFT JOIN laser_tag_slots s ON r.slot_id = s.slot_id
        `;
        if (filter === 'PENDING_VERIFICATION') q += ` WHERE r.payment_status = 'PENDING_VERIFICATION'`;
        else if (filter === 'APPROVED') q += ` WHERE r.payment_status = 'APPROVED'`;
        else if (filter === 'REJECTED') q += ` WHERE r.payment_status = 'REJECTED'`;
        else if (filter === 'SOLO') q += ` WHERE r.registration_type = 'SOLO'`;
        else if (filter === 'GROUP') q += ` WHERE r.registration_type = 'GROUP'`;
        q += ` ORDER BY r.created_at DESC`;

        const [regs, players, stats] = await Promise.all([
          execute(q),
          execute('SELECT * FROM laser_tag_players ORDER BY registration_id, player_number ASC'),
          execute(`
            SELECT 
              SUM(CASE WHEN booking_status = 'CONFIRMED' THEN player_count ELSE 0 END) as confirmed_players,
              SUM(CASE WHEN booking_status = 'PENDING_APPROVAL' THEN player_count ELSE 0 END) as pending_players,
              SUM(CASE WHEN payment_status = 'APPROVED' THEN total_fee ELSE 0 END) as approved_revenue,
              SUM(CASE WHEN payment_status = 'PENDING_VERIFICATION' THEN total_fee ELSE 0 END) as pending_revenue,
              SUM(CASE WHEN registration_type = 'SOLO' THEN 1 ELSE 0 END) as total_solo
            FROM laser_tag_registrations
          `),
        ]);

        const playerMap = {};
        players.forEach(p => {
          if (!playerMap[p.registration_id]) playerMap[p.registration_id] = [];
          playerMap[p.registration_id].push(p);
        });

        const formatted = regs.map(r => ({
          ...r,
          time_window: r.start_time && r.end_time ? `${formatTime12h(r.start_time)} – ${formatTime12h(r.end_time)}` : 'Solo Matchmaking Pool',
          players: playerMap[r.registration_id] || [],
        }));

        const statRow = stats[0] || {};
        return sendJson(res, 200, {
          success: true,
          registrations: formatted,
          kpis: {
            totalSlots: 15,
            confirmedPlayers: Number(statRow.confirmed_players || 0),
            pendingPlayers: Number(statRow.pending_players || 0),
            approvedRevenue: Number(statRow.approved_revenue || 0),
            pendingRevenue: Number(statRow.pending_revenue || 0),
            totalSolo: Number(statRow.total_solo || 0),
          }
        });
      }

      // 5. GET /api/laser-tag/lookup
      if (req.method === 'GET' && pathname === '/api/laser-tag/lookup') {
        const q = parsedUrl.searchParams.get('q') || '';
        if (!q.trim()) return sendJson(res, 200, { results: [] });

        const term = q.trim();
        const regs = await execute(
          `SELECT r.*, s.start_time, s.end_time 
           FROM laser_tag_registrations r
           LEFT JOIN laser_tag_slots s ON r.slot_id = s.slot_id
           WHERE r.registration_id = ? OR LOWER(r.captain_email) = LOWER(?) OR r.captain_phone = ?
           ORDER BY r.created_at DESC`,
          [term, term, term]
        );

        if (regs.length === 0) return sendJson(res, 200, { results: [] });

        const regIds = regs.map(r => r.registration_id);
        const players = await execute(
          `SELECT * FROM laser_tag_players WHERE registration_id IN (${regIds.map(() => '?').join(',')}) ORDER BY player_number ASC`,
          regIds
        );

        const playerMap = {};
        players.forEach(p => {
          if (!playerMap[p.registration_id]) playerMap[p.registration_id] = [];
          playerMap[p.registration_id].push(p);
        });

        const results = regs.map(r => ({
          ...r,
          time_window: r.start_time && r.end_time ? `${formatTime12h(r.start_time)} – ${formatTime12h(r.end_time)}` : 'Solo Matchmaking Pool',
          players: playerMap[r.registration_id] || [],
        }));

        return sendJson(res, 200, { results });
      }

      next();
    } catch (err) {
      console.error('Laser Tag API error:', err);
      sendJson(res, 500, { error: err.message || 'Internal server error' });
    }
  };
}
