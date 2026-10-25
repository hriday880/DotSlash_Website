import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Users, User, Clock, Zap, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { db } from '../lib/db';

const MODES = [
  {
    id: 'SOLO',
    label: 'Solo Entry',
    playersCount: 1,
    price: 150,
    subtitle: '1 Player · Auto-paired into a 4v4 arena squad',
    badge: '₹150'
  },
  {
    id: 'DUO',
    label: 'Duo Squad',
    playersCount: 2,
    price: 300,
    subtitle: '2 Players · Paired together on the same team',
    badge: '₹300'
  },
  {
    id: 'TRIO',
    label: 'Trio Squad',
    playersCount: 3,
    price: 450,
    subtitle: '3 Players · Paired together + 1 solo teammate',
    badge: '₹450'
  },
  {
    id: 'SQUAD',
    label: 'Full Squad (4 Players)',
    playersCount: 4,
    price: 500,
    subtitle: '4 Players · Complete 4-player side (₹50 off)',
    badge: '₹500'
  }
];

const SLOTS = [
  'Slot 1 · 8:00 PM – 8:20 PM',
  'Slot 2 · 8:20 PM – 8:40 PM',
  'Slot 3 · 8:40 PM – 9:00 PM',
  'Slot 4 · 9:00 PM – 9:20 PM',
  'Slot 5 · 9:20 PM – 9:40 PM',
  'Slot 6 · 9:40 PM – 10:00 PM',
  'Slot 7 · 10:00 PM – 10:20 PM',
  'Slot 8 · 10:20 PM – 10:40 PM',
  'Slot 9 · 10:40 PM – 11:00 PM',
  'Slot 10 · 11:00 PM – 11:20 PM',
  'Slot 11 · 11:20 PM – 11:40 PM',
  'Slot 12 · 11:40 PM – 12:00 AM',
  'Slot 13 · 12:00 AM – 12:20 AM',
  'Slot 14 · 12:20 AM – 12:40 AM',
  'Slot 15 · 12:40 AM – 1:00 AM'
];

const EMPTY_PLAYER = () => ({
  name: '',
  email: '',
  phone: '',
  studentId: ''
});

export default function LaserTag() {
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') || 'SOLO').toUpperCase();
  const validInitialMode = MODES.some(m => m.id === initialMode) ? initialMode : 'SOLO';

  const [selectedMode, setSelectedMode] = useState(validInitialMode);
  const [squadName, setSquadName] = useState('');
  const [preferredSlot, setPreferredSlot] = useState(SLOTS[0]);
  const [players, setPlayers] = useState([
    EMPTY_PLAYER(),
    EMPTY_PLAYER(),
    EMPTY_PLAYER(),
    EMPTY_PLAYER()
  ]);

  const [gatewayBaseUrl, setGatewayBaseUrl] = useState('http://localhost:7100');
  const [gatewayOnline, setGatewayOnline] = useState(false);
  const [gatewayChecking, setGatewayChecking] = useState(true);

  const [isLaunchingGateway, setIsLaunchingGateway] = useState(false);
  const [activeGatewaySession, setActiveGatewaySession] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedReceipt, setConfirmedReceipt] = useState(null);

  const pollTimerRef = useRef(null);

  const modeConfig = MODES.find(m => m.id === selectedMode) || MODES[0];

  // Ensure Turso table exists and resolve live YouPI-PG Gateway URL
  useEffect(() => {
    let cancelled = false;

    async function initGatewayAndDb() {
      setGatewayChecking(true);
      try {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS laser_tag_registrations (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            payment_id TEXT NOT NULL,
            mode TEXT NOT NULL,
            squad_name TEXT,
            players_count INTEGER NOT NULL,
            amount_inr INTEGER NOT NULL,
            lead_name TEXT NOT NULL,
            lead_email TEXT NOT NULL,
            lead_phone TEXT NOT NULL,
            lead_student_id TEXT,
            players_json TEXT NOT NULL,
            preferred_slot TEXT NOT NULL,
            payment_status TEXT NOT NULL,
            utr TEXT,
            verified_at TEXT NOT NULL
          )
        `);
      } catch (e) {
        console.warn('Turso table init warning:', e.message);
      }

      const candidates = [];
      const isLocal =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (isLocal) {
        candidates.push('http://localhost:7100');
      }

      try {
        const res = await db.execute(
          `SELECT public_url, local_url FROM youpi_gateway_config WHERE id = 'primary' LIMIT 1`
        );
        const rows = res?.rows || [];
        if (rows[0]?.public_url) {
          candidates.push(rows[0].public_url.replace(/\/+$/, ''));
        }
        if (!isLocal && rows[0]?.local_url) {
          candidates.push(rows[0].local_url.replace(/\/+$/, ''));
        }
      } catch {}

      if (!isLocal) {
        candidates.push('http://localhost:7100');
      }

      for (const url of candidates) {
        try {
          const res = await fetch(`${url}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3500)
          });
          if (res.ok) {
            if (!cancelled) {
              setGatewayBaseUrl(url);
              setGatewayOnline(true);
              setGatewayChecking(false);
            }
            return;
          }
        } catch {}
      }

      if (!cancelled) {
        if (candidates[0]) setGatewayBaseUrl(candidates[0]);
        setGatewayOnline(false);
        setGatewayChecking(false);
      }
    }

    initGatewayAndDb();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for postMessage events from the embedded YouPI-PG Checkout Portal iframe
  useEffect(() => {
    function handleGatewayMessage(e) {
      const payload = e.data;
      if (!payload || typeof payload !== 'object') return;

      const evt = payload.event || payload.type || '';
      if (
        evt === 'youpi.payment_success' ||
        evt === 'PAYMENT_SUCCESS' ||
        payload.status === 'SUCCESS'
      ) {
        if (activeGatewaySession) {
          verifyAndFinalizeOrder(
            activeGatewaySession.paymentId,
            activeGatewaySession.orderId,
            payload.data?.utr || payload.utr || null
          );
        }
      } else if (
        evt === 'youpi.modal_close' ||
        evt === 'youpi.close' ||
        evt === 'youpi.cancel' ||
        evt === 'youpi.payment_cancelled'
      ) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setActiveGatewaySession(null);
      }
    }

    window.addEventListener('message', handleGatewayMessage);
    return () => window.removeEventListener('message', handleGatewayMessage);
  }, [activeGatewaySession]);

  function updatePlayer(index, field, value) {
    setPlayers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function validateForm() {
    const activePlayers = players.slice(0, modeConfig.playersCount);

    if (modeConfig.playersCount > 1 && !squadName.trim()) {
      return 'Please enter a Squad Name for your team.';
    }

    for (let i = 0; i < activePlayers.length; i++) {
      const p = activePlayers[i];
      const label = i === 0 ? 'Lead Player (Player 1)' : `Player ${i + 1}`;
      if (!p.name.trim()) {
        return `Please enter Full Name for ${label}.`;
      }
      if (!p.email.trim() || !p.email.includes('@')) {
        return `Please enter a valid Email Address for ${label}.`;
      }
      const cleanPhone = p.phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        return `Please enter a valid 10-digit WhatsApp/Mobile number for ${label}.`;
      }
    }

    return null;
  }

  async function verifyAndFinalizeOrder(paymentId, orderId, fallbackUtr = null) {
    try {
      const res = await fetch(`${gatewayBaseUrl}/api/v1/payments/${encodeURIComponent(paymentId)}`);
      if (!res.ok) return false;
      const paymentData = await res.json();

      if (paymentData.status !== 'SUCCESS') {
        return false;
      }

      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      const activePlayers = players.slice(0, modeConfig.playersCount).map(p => ({
        name: p.name.trim(),
        email: p.email.trim().toLowerCase(),
        phone: p.phone.replace(/\D/g, '').slice(-10),
        studentId: p.studentId.trim()
      }));

      const lead = activePlayers[0];
      const verifiedAt = new Date().toISOString();
      const utr = paymentData.utr || fallbackUtr || 'VERIFIED-BY-OBSERVER';
      const registrationId = `LT-REG-${Date.now().toString(36).toUpperCase()}`;

      await db.execute(
        `INSERT INTO laser_tag_registrations (
          id, order_id, payment_id, mode, squad_name, players_count, amount_inr,
          lead_name, lead_email, lead_phone, lead_student_id, players_json,
          preferred_slot, payment_status, utr, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?)`,
        [
          registrationId,
          orderId,
          paymentId,
          modeConfig.id,
          modeConfig.playersCount > 1 ? squadName.trim() : `${lead.name} (Solo)`,
          modeConfig.playersCount,
          modeConfig.price,
          lead.name,
          lead.email,
          lead.phone,
          lead.studentId || '',
          JSON.stringify(activePlayers),
          preferredSlot,
          utr,
          verifiedAt
        ]
      );

      setActiveGatewaySession(null);
      setConfirmedReceipt({
        registrationId,
        orderId,
        paymentId,
        mode: modeConfig.label,
        squadName: modeConfig.playersCount > 1 ? squadName.trim() : `${lead.name} (Solo)`,
        playersCount: modeConfig.playersCount,
        amount: modeConfig.price,
        preferredSlot,
        players: activePlayers,
        utr,
        verifiedAt
      });
      return true;
    } catch (err) {
      console.error('Error finalizing verified payment:', err);
      return false;
    }
  }

  async function handleLaunchYoupiGateway(e) {
    e.preventDefault();
    setErrorMsg('');

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setIsLaunchingGateway(true);

    try {
      const lead = players[0];
      const cleanPhone = lead.phone.replace(/\D/g, '').slice(-10);
      const orderId = `LT-${modeConfig.id}-${Date.now().toString(36).toUpperCase()}`;

      const createRes = await fetch(`${gatewayBaseUrl}/api/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Id': '00000000-0000-0000-0000-000000000001'
        },
        body: JSON.stringify({
          orderId,
          amount: modeConfig.price.toFixed(2),
          currency: 'INR',
          customer: {
            fullName: lead.name.trim(),
            name: lead.name.trim(),
            email: lead.email.trim().toLowerCase(),
            phoneNumber: cleanPhone,
            mobileNumber: cleanPhone
          },
          description: `DotSlash X Glitch Laser Tag · ${modeConfig.label}`,
          metadata: {
            mode: modeConfig.id,
            playersCount: modeConfig.playersCount,
            squadName: modeConfig.playersCount > 1 ? squadName.trim() : `${lead.name.trim()} (Solo)`,
            preferredSlot
          }
        })
      });

      const data = await createRes.json();
      if (!createRes.ok || !data.paymentId) {
        throw new Error(data.error || data.message || 'Unable to initialize YouPI-PG payment session.');
      }

      const checkoutIframeUrl = `${gatewayBaseUrl}/checkout/${encodeURIComponent(data.paymentId)}?embedded=1`;

      setActiveGatewaySession({
        paymentId: data.paymentId,
        orderId,
        amount: modeConfig.price,
        checkoutUrl: checkoutIframeUrl
      });

      // Start real-time status polling against YouPI-PG Payment API
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        const done = await verifyAndFinalizeOrder(data.paymentId, orderId);
        if (done && pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }, 2000);
    } catch (err) {
      setErrorMsg(
        err.message ||
          'Could not connect to the YouPI Payment Gateway. Make sure the gateway service is running.'
      );
    } finally {
      setIsLaunchingGateway(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Top Banner */}
        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-950/30 to-zinc-950 p-6 sm:p-8 mb-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
              <Zap className="w-3.5 h-3.5" /> DotSlash × Glitch · Laser Tag Arena
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
                gatewayChecking
                  ? 'bg-zinc-900 text-zinc-400 border-zinc-700'
                  : gatewayOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  gatewayChecking
                    ? 'bg-zinc-400 animate-pulse'
                    : gatewayOnline
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              {gatewayChecking
                ? 'Connecting to YouPI Gateway...'
                : gatewayOnline
                ? 'YouPI-PG Automated Gateway Online'
                : 'YouPI-PG Gateway Standby'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Laser Tag Registration &amp; Instant YouPI Checkout
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Venue: <strong className="text-zinc-200">Learning Commons A&amp;B</strong> · 20-Minute
            Arena Slots (10m Active Combat, 5m Briefing, 5m Debrief). Payments are verified{' '}
            <strong className="text-emerald-400">automatically in real time by YouPI-PG</strong> — no
            manual UTR entry required.
          </p>
        </div>

        {/* Confirmed Receipt View */}
        {confirmedReceipt ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-zinc-950 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                  Verified by YouPI-PG Banking Observer
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Registration &amp; Payment Confirmed!
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 mb-6 text-sm">
              <div>
                <span className="text-zinc-500 block text-xs">Registration ID</span>
                <span className="font-mono font-semibold text-white">
                  {confirmedReceipt.registrationId}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-xs">YouPI Order ID</span>
                <span className="font-mono font-semibold text-white">
                  {confirmedReceipt.orderId}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-xs">Mode &amp; Squad</span>
                <span className="font-semibold text-white">
                  {confirmedReceipt.mode} · {confirmedReceipt.squadName}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-xs">Amount Verified</span>
                <span className="font-bold text-emerald-400">₹{confirmedReceipt.amount}.00</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-xs">Preferred Slot</span>
                <span className="text-zinc-200">{confirmedReceipt.preferredSlot}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-xs">YouPI Payment Session</span>
                <span className="font-mono text-xs text-zinc-300">
                  {confirmedReceipt.paymentId}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                Registered Roster ({confirmedReceipt.playersCount} Player
                {confirmedReceipt.playersCount > 1 ? 's' : ''})
              </h3>
              <div className="space-y-2">
                {confirmedReceipt.players.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-sm"
                  >
                    <span className="font-medium text-white">
                      {idx + 1}. {p.name}
                    </span>
                    <span className="text-xs font-mono text-zinc-400">
                      {p.email} · +91 {p.phone}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmedReceipt(null);
                setPlayers([EMPTY_PLAYER(), EMPTY_PLAYER(), EMPTY_PLAYER(), EMPTY_PLAYER()]);
                setSquadName('');
              }}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm transition"
            >
              Register Another Squad / Player
            </button>
          </div>
        ) : (
          <form onSubmit={handleLaunchYoupiGateway} className="space-y-6">
            {/* SECTION 1: SQUAD SIZE & MODE */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 overflow-hidden">
              <div className="bg-zinc-900/90 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 block">
                    Section 1 of 4
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-red-400" /> Choose Registration Mode
                  </h2>
                </div>
                <span className="text-sm font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
                  Total: ₹{modeConfig.price}
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {MODES.map(m => {
                  const active = selectedMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMode(m.id)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        active
                          ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-950/30'
                          : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white text-sm sm:text-base">{m.label}</span>
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${
                            active
                              ? 'bg-red-500 text-white'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">{m.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: PLAYER / SQUAD DETAILS */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 overflow-hidden">
              <div className="bg-zinc-900/90 border-b border-zinc-800 px-6 py-4">
                <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 block">
                  Section 2 of 4
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-red-400" />{' '}
                  {modeConfig.playersCount === 1
                    ? 'Solo Player Details'
                    : `${modeConfig.label} Roster (${modeConfig.playersCount} Players)`}
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {modeConfig.playersCount > 1 && (
                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-300 mb-1.5">
                      Squad / Team Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={squadName}
                      onChange={e => setSquadName(e.target.value)}
                      placeholder="e.g. Neon Vipers"
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red-500"
                    />
                  </div>
                )}

                {Array.from({ length: modeConfig.playersCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/90 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-red-400 font-semibold">
                        {idx === 0
                          ? 'Player 1 · Lead Player (Payment Contact)'
                          : `Player ${idx + 1} · Squad Teammate`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={players[idx].name}
                          onChange={e => updatePlayer(idx, 'name', e.target.value)}
                          placeholder="Full Name"
                          className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          FLAME Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={players[idx].email}
                          onChange={e => updatePlayer(idx, 'email', e.target.value)}
                          placeholder="student@flame.edu.in"
                          className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          10-Digit WhatsApp / Mobile Number *
                        </label>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={players[idx].phone}
                          onChange={e =>
                            updatePlayer(idx, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))
                          }
                          placeholder="10-digit mobile number"
                          className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          FLAME Student ID / Roll No.
                        </label>
                        <input
                          type="text"
                          value={players[idx].studentId}
                          onChange={e => updatePlayer(idx, 'studentId', e.target.value)}
                          placeholder="e.g. FU2026..."
                          className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 3: PREFERRED TIME SLOT */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 overflow-hidden">
              <div className="bg-zinc-900/90 border-b border-zinc-800 px-6 py-4">
                <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 block">
                  Section 3 of 4
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-400" /> Preferred Arena Time Slot
                </h2>
              </div>

              <div className="p-6">
                <label className="block text-xs text-zinc-400 mb-2">
                  Select your preferred 20-minute slot at Learning Commons A&amp;B
                </label>
                <select
                  value={preferredSlot}
                  onChange={e => setPreferredSlot(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red-500"
                >
                  {SLOTS.map(slot => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SECTION 4: OFFICIAL YOUPI-PG AUTOMATED CHECKOUT */}
            <div className="rounded-2xl border border-red-500/30 bg-zinc-950/95 overflow-hidden">
              <div className="bg-zinc-900/90 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 block">
                    Section 4 of 4 · Automated UPI Gateway
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Instant Payment via YouPI-PG
                  </h2>
                </div>
                <span className="text-xs font-mono text-zinc-400">0% Gateway Fee · Auto-Verified</span>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div>
                    <div className="text-xs text-zinc-400">Merchant Account</div>
                    <div className="text-sm font-bold text-white">
                      DotSlash X Glitch (Verified YouPI-PG Gateway)
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Dynamic Vector QR · Single-Slot Queue · Real-Time Bank SMS &amp; Gmail Observer
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400">Payable Amount</div>
                    <div className="text-2xl font-extrabold text-emerald-400">
                      ₹{modeConfig.price}.00
                    </div>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 bg-red-950/20 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                  <strong className="text-red-300">Note:</strong> Payments are strictly
                  non-refundable. Clicking below opens the live{' '}
                  <strong className="text-white">YouPI-PG Payment Gateway</strong> modal which
                  automatically detects and confirms your UPI transfer without manual UTR entry.
                </div>

                {errorMsg && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLaunchingGateway}
                  className="w-full py-4 px-6 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-base shadow-lg shadow-red-950/50 transition flex items-center justify-center gap-2"
                >
                  {isLaunchingGateway ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Initializing YouPI-PG Session...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Pay ₹{modeConfig.price}.00 with YouPI Payment Gateway
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* LIVE YOUPI-PG CHECKOUT MODAL OVERLAY */}
      {activeGatewaySession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="relative w-full max-w-[920px] h-[90vh] max-h-[680px] bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-700 flex flex-col">
            <div className="bg-zinc-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-zinc-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono font-semibold">
                  YOUPI PG LIVE CHECKOUT · Order #{activeGatewaySession.orderId}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={activeGatewaySession.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-400 hover:text-white"
                >
                  Open in New Tab <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (pollTimerRef.current) {
                      clearInterval(pollTimerRef.current);
                      pollTimerRef.current = null;
                    }
                    setActiveGatewaySession(null);
                  }}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <iframe
              src={activeGatewaySession.checkoutUrl}
              title="YouPI-PG Live Payment Gateway"
              className="w-full flex-1 border-0 bg-white"
              allow="clipboard-write; payment"
            />
          </div>
        </div>
      )}
    </div>
  );
}
