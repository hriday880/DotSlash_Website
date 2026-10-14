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
        const slots = await execute('SELECT * FROM laser_tag_slots ORDER BY slot_id ASC');
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

          const startHour = parseInt(slot.start_time.split(':')[0], 10);
          return {
            slot_id: slot.slot_id,
            start_time: slot.start_time,
            end_time: slot.end_time,
            time_window: `${formatTime12h(slot.start_time)} – ${formatTime12h(slot.end_time)}`,
            hour_block: String(startHour),
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

      // 2. POST /api/laser-tag/register
      if (req.method === 'POST' && pathname === '/api/laser-tag/register') {
        const body = await readJsonBody(req);
        const { slotId, team, players, utrReference, screenshotUrl } = body;

        if (!slotId || !team || !Array.isArray(players) || players.length < 1 || players.length > 4) {
          return sendJson(res, 400, { error: 'Invalid payload: slotId, team, and 1-4 players are required' });
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

        const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
        const timeSuffix = Date.now().toString(36).slice(-4).toUpperCase();
        const registrationId = `LT-OCT22-${timeSuffix}${randomSuffix}`;
        const playerCount = players.length;
        const totalFee = playerCount * 100;
        const note = `LT ${slotId} ${team}`;
        const upiPayload = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Laser%20Tag%20Oct22&am=${totalFee}.00&cu=INR&tn=${encodeURIComponent(note)}`;

        await execute(
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
            players,
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

      // 4. GET /api/laser-tag/admin/registrations
      if (req.method === 'GET' && pathname === '/api/laser-tag/admin/registrations') {
        const filter = parsedUrl.searchParams.get('status') || 'ALL';
        let q = `
          SELECT r.*, s.start_time, s.end_time 
          FROM laser_tag_registrations r
          JOIN laser_tag_slots s ON r.slot_id = s.slot_id
        `;
        if (filter === 'PENDING_VERIFICATION') q += ` WHERE r.payment_status = 'PENDING_VERIFICATION'`;
        else if (filter === 'APPROVED') q += ` WHERE r.payment_status = 'APPROVED'`;
        else if (filter === 'REJECTED') q += ` WHERE r.payment_status = 'REJECTED'`;
        q += ` ORDER BY r.created_at DESC`;

        const [regs, players, stats] = await Promise.all([
          execute(q),
          execute('SELECT * FROM laser_tag_players ORDER BY registration_id, player_number ASC'),
          execute(`
            SELECT 
              SUM(CASE WHEN booking_status = 'CONFIRMED' THEN player_count ELSE 0 END) as confirmed_players,
              SUM(CASE WHEN booking_status = 'PENDING_APPROVAL' THEN player_count ELSE 0 END) as pending_players,
              SUM(CASE WHEN payment_status = 'APPROVED' THEN total_fee ELSE 0 END) as approved_revenue,
              SUM(CASE WHEN payment_status = 'PENDING_VERIFICATION' THEN total_fee ELSE 0 END) as pending_revenue
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
          time_window: `${formatTime12h(r.start_time)} – ${formatTime12h(r.end_time)}`,
          players: playerMap[r.registration_id] || [],
        }));

        const statRow = stats[0] || {};
        return sendJson(res, 200, {
          success: true,
          registrations: formatted,
          kpis: {
            totalSlots: 36,
            confirmedPlayers: Number(statRow.confirmed_players || 0),
            pendingPlayers: Number(statRow.pending_players || 0),
            approvedRevenue: Number(statRow.approved_revenue || 0),
            pendingRevenue: Number(statRow.pending_revenue || 0),
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
           JOIN laser_tag_slots s ON r.slot_id = s.slot_id
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
          time_window: `${formatTime12h(r.start_time)} – ${formatTime12h(r.end_time)}`,
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
