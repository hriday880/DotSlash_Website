import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, LogOut, ArrowLeft, Tag } from 'lucide-react';
import { laserTagApi, safeStorage } from '../lib/laserTagApi';

const TOKEN_KEY = 'lt_admin_token';
const storage = safeStorage('session');

const input =
  'w-full bg-[#F4F4F5] border border-[#E4E4E7] text-[#030303] px-3.5 py-2.5 font-mono text-sm focus:outline-none focus:border-[#3300FF]';
const tabBtn = active =>
  `px-4 py-2 font-sans text-xs tracking-widest uppercase font-semibold border ${
    active ? 'bg-[#030303] text-white border-[#030303]' : 'bg-white text-[#030303] border-[#E4E4E7]'
  }`;

function BookingRow({ b, onCheckin, busy, highlight }) {
  return (
    <div className={`p-4 bg-white border rounded-lg ${highlight ? 'border-[#3300FF] ring-2 ring-[#3300FF]' : 'border-[#E4E4E7]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-[#030303]">
            {b.id} · Team {b.team} · {b.mode} {b.squad_name && b.mode !== 'SOLO' ? `· ${b.squad_name}` : ''}
          </p>
          <p className="font-mono text-xs text-[#52525B]">Slot {b.slot} · {b.slotLabel} · ₹{b.amount}{b.promo_code ? ` (${b.promo_code})` : ''}</p>
        </div>
        {b.status === 'HOLD' ? (
          <span className="font-mono text-xs text-[#D97706]">Paying now (3-min hold)</span>
        ) : b.status === 'PENDING' ? (
          <span className="font-mono text-xs text-[#D97706]">Awaiting verification · UTR {b.utr}</span>
        ) : b.status === 'REJECTED' ? (
          <span className="font-mono text-xs text-[#DC2626]">Rejected</span>
        ) : b.checked_in_at ? (
          <button type="button" disabled={busy} onClick={() => onCheckin(b.id, true)} className="flex items-center gap-1.5 font-mono text-xs text-[#059669]">
            <CheckCircle2 className="w-4 h-4" /> Checked in · undo
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => onCheckin(b.id)} className="px-4 py-2 bg-[#3300FF] text-white font-sans text-xs tracking-widest uppercase font-semibold disabled:opacity-50">
            Check in
          </button>
        )}
      </div>
      <ul className="mt-2 font-mono text-xs text-[#030303] space-y-0.5">
        {b.players.map((p, i) => <li key={i}>{i + 1}. {p.name} · {p.phone} · {p.email}{p.studentId ? ` · ${p.studentId}` : ''}</li>)}
      </ul>
      {b.note && <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-[#B91C1C]"><AlertTriangle className="w-3.5 h-3.5" /> {b.note}</p>}
    </div>
  );
}

function VerifyCard({ b, token, onReview, busy }) {
  const [image, setImage] = useState('');
  const [imgError, setImgError] = useState('');

  async function loadProof() {
    setImgError('');
    try {
      setImage((await laserTagApi.adminProof(token, b.id)).image);
    } catch (err) {
      setImgError(err.message);
    }
  }

  function reject() {
    const reason = window.prompt('Reason shown to the player:', 'We couldn’t find this payment in our UPI account.');
    if (reason !== null) onReview(b.id, 'reject', reason);
  }

  return (
    <div className="p-4 bg-white border border-[#E4E4E7] rounded-lg space-y-3">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="font-mono text-sm text-[#030303] space-y-0.5">
          <p className="font-bold">{b.id} · ₹{b.amount}{b.promo_code ? ` (${b.promo_code})` : ''}</p>
          <p>UTR <strong className="tracking-wider text-[#3300FF]">{b.utr}</strong></p>
          <p className="text-xs text-[#52525B]">
            {b.lead_name} · {b.lead_phone} · Slot {b.slot} ({b.slotLabel}) · Team {b.team} · {b.mode}
          </p>
          <p className="text-xs text-[#52525B]">Submitted {new Date(b.utr_submitted_at).toLocaleString('en-IN')}</p>
          {b.note && <p className="flex items-center gap-1.5 text-xs text-[#B91C1C]"><AlertTriangle className="w-3.5 h-3.5" /> {b.note}</p>}
        </div>
        <div className="flex gap-2 items-start">
          <button type="button" disabled={busy} onClick={() => onReview(b.id, 'approve')} className="px-4 py-2 bg-[#059669] text-white font-sans text-xs tracking-widest uppercase font-semibold disabled:opacity-50">
            Approve
          </button>
          <button type="button" disabled={busy} onClick={reject} className="px-4 py-2 border border-[#DC2626] text-[#DC2626] font-sans text-xs tracking-widest uppercase font-semibold disabled:opacity-50">
            Reject
          </button>
        </div>
      </div>
      {image ? (
        <a href={image} target="_blank" rel="noreferrer"><img src={image} alt={`Payment screenshot for ${b.id}`} className="max-h-96 border border-[#E4E4E7]" /></a>
      ) : (
        <button type="button" onClick={loadProof} className="font-mono text-xs text-[#3300FF] underline">Show screenshot</button>
      )}
      {imgError && <p className="font-mono text-xs text-[#DC2626]">{imgError}</p>}
    </div>
  );
}

export default function LaserTagAdmin() {
  const [searchParams] = useSearchParams();
  const checkinId = (searchParams.get('checkin') || '').toUpperCase();

  const [token, setToken] = useState(() => storage.get(TOKEN_KEY));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState(checkinId ? 'checkin' : 'verify');
  const [query, setQuery] = useState(checkinId);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await laserTagApi.adminOverview(token));
      setError('');
    } catch (err) {
      if (err.status === 401) {
        storage.remove(TOKEN_KEY);
        setToken(null);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      const auth = localStorage.getItem('dotslash_admin_auth');
      if (auth === 'superadmin' || auth === 'true') {
        laserTagApi.getSessionToken().then((t) => {
          storage.set(TOKEN_KEY, t);
          setToken(t);
        }).catch(() => {});
      }
    }
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function login(e) {
    e.preventDefault();
    setLoginError('');
    try {
      const { token: t } = await laserTagApi.adminLogin(password);
      storage.set(TOKEN_KEY, t);
      setToken(t);
      setPassword('');
    } catch (err) {
      setLoginError(err.message);
    }
  }

  async function review(id, action, reason) {
    setBusyId(id);
    try {
      await laserTagApi.adminReview(token, id, action, reason);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function checkin(id, undo = false) {
    setBusyId(id);
    try {
      await laserTagApi.adminCheckin(token, id, undo);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const paid = useMemo(() => (data?.bookings || []).filter(b => b.status === 'PAID'), [data]);
  const pendingReview = useMemo(
    () => (data?.bookings || []).filter(b => b.status === 'PENDING').sort((a, b) => a.utr_submitted_at - b.utr_submitted_at),
    [data]
  );
  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return (data?.bookings || []).filter(b =>
      b.id === q ||
      b.lead_phone.includes(q) ||
      b.players.some(p => p.name.toUpperCase().includes(q) || p.phone.includes(q) || p.email.toUpperCase().includes(q))
    );
  }, [data, query]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] pt-28 px-4">
        <form onSubmit={login} className="max-w-sm mx-auto bg-white border border-[#E4E4E7] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="font-sans text-xl font-semibold uppercase tracking-wider text-[#3300FF]">Laser Tag Admin</h1>
            <Link to="/admin" className="font-mono text-xs text-[#52525B] hover:text-[#3300FF]">← Command Center</Link>
          </div>
          <input className={input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoFocus required />
          {loginError && <p className="font-mono text-xs text-[#DC2626]">{loginError}</p>}
          <button type="submit" className="w-full py-3 bg-[#030303] text-white font-sans text-xs tracking-widest uppercase font-semibold">Log in</button>
        </form>
      </div>
    );
  }

  const totals = {
    bookings: paid.length,
    players: paid.reduce((n, b) => n + b.seats, 0),
    revenue: paid.reduce((n, b) => n + b.amount, 0),
    checkedIn: paid.filter(b => b.checked_in_at).reduce((n, b) => n + b.seats, 0)
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] pt-28 pb-20 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="p-2 border border-[#E4E4E7] bg-white hover:border-[#3300FF] text-[#52525B] hover:text-[#3300FF] transition-colors rounded"
              title="Return to Main Command Center"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="font-sans text-2xl font-semibold uppercase tracking-wider text-[#3300FF]">Laser Tag Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="px-3 py-2 border border-[#E4E4E7] bg-white font-mono text-xs uppercase tracking-wider text-[#52525B] hover:text-[#3300FF] hover:border-[#3300FF] transition-colors"
            >
              ← Command Center
            </Link>
            <button type="button" onClick={load} className="p-2 border border-[#E4E4E7] bg-white" aria-label="Refresh">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => { storage.remove(TOKEN_KEY); setToken(null); }} className="p-2 border border-[#E4E4E7] bg-white" aria-label="Log out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['Bookings', totals.bookings], ['Players', totals.players], ['Checked in', `${totals.checkedIn}/${totals.players}`], ['Collected', `₹${totals.revenue}`]].map(([k, v]) => (
            <div key={k} className="bg-white border border-[#E4E4E7] rounded-lg p-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[#52525B]">{k}</p>
              <p className="font-sans text-2xl font-semibold text-[#030303]">{v}</p>
            </div>
          ))}
        </div>

        {/* Ambassador Promocodes Live Counters */}
        <div className="bg-white border border-[#E4E4E7] rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 border-b border-[#E4E4E7] pb-3">
            <div>
              <h2 className="font-sans text-base font-semibold uppercase tracking-wider text-[#030303] flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#3300FF]" /> Ambassador Promocodes (10% Discount · Unexhaustable)
              </h2>
              <p className="font-mono text-xs text-[#52525B]">Live usage counters for Dhairya and Takshh</p>
            </div>
            <button
              type="button"
              onClick={() => setTab('promos')}
              className="font-mono text-xs text-[#3300FF] hover:underline"
            >
              View detailed usages →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {['DHAIRYA', 'TAKSHH'].map(code => {
              const promo = data?.unexhaustablePromos?.find(p => p.code === code) || { totalUses: 0, paidCount: 0, pendingCount: 0, heldCount: 0, revenue: 0, bookings: [] };
              return (
                <div key={code} className="p-4 border border-[#E4E4E7] rounded-lg bg-[#FAFAFA] flex flex-col justify-between hover:border-[#3300FF]/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold uppercase tracking-wider px-2.5 py-1 bg-[#3300FF] text-white rounded">
                          {code}
                        </span>
                        <span className="font-mono text-[11px] text-[#059669] font-semibold bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">
                          10% OFF
                        </span>
                      </div>
                      <p className="font-mono text-xs text-[#52525B] mt-2">Unexhaustable · Unlimited uses</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-[#52525B]">Total Times Used</p>
                      <p className="font-sans text-3xl font-bold text-[#030303]">{promo.totalUses}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E4E4E7] flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-[#52525B]">
                    <span>
                      <strong className="text-[#059669]">{promo.paidCount}</strong> paid · <strong className="text-[#D97706]">{promo.pendingCount}</strong> pending {promo.heldCount > 0 && <span>· <span className="text-[#3300FF]">{promo.heldCount} holding</span></span>}
                    </span>
                    <span className="font-bold text-[#030303]">₹{promo.revenue} collected</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="font-mono text-xs text-[#DC2626]">{error}</p>}

        {data?.tamperedRows?.length > 0 && (
          <div className="flex items-start gap-2 p-4 border border-[#DC2626] bg-[#FEF2F2] rounded-lg font-mono text-xs text-[#B91C1C]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {data.tamperedRows.length} booking row(s) were added or edited outside this system and are being ignored:{' '}
              {data.tamperedRows.join(', ')}. Don’t let these in without checking the payment yourself.
            </span>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button type="button" className={tabBtn(tab === 'verify')} onClick={() => setTab('verify')}>
            Verify payments{pendingReview.length ? ` (${pendingReview.length})` : ''}
          </button>
          <button type="button" className={tabBtn(tab === 'checkin')} onClick={() => setTab('checkin')}>Check-in</button>
          <button type="button" className={tabBtn(tab === 'slots')} onClick={() => setTab('slots')}>Slots</button>
          <button type="button" className={tabBtn(tab === 'promos')} onClick={() => setTab('promos')}>
            Promo codes
            {data?.unexhaustablePromos && (
              <span className="ml-1.5 opacity-80 font-normal">
                (Dhairya: {data.unexhaustablePromos.find(p => p.code === 'DHAIRYA')?.totalUses || 0} · Takshh: {data.unexhaustablePromos.find(p => p.code === 'TAKSHH')?.totalUses || 0})
              </span>
            )}
          </button>
        </div>

        {tab === 'verify' && data && (
          <div className="space-y-3">
            <p className="font-mono text-xs text-[#52525B]">
              Open your UPI / bank app for <strong>{data.upiId}</strong>, find a credit with the same UTR and amount, then approve. Oldest first.
            </p>
            {!pendingReview.length && <p className="font-mono text-sm text-[#52525B]">Nothing waiting. 🎯</p>}
            {pendingReview.map(b => (
              <VerifyCard key={b.id} b={b} token={token} onReview={review} busy={busyId === b.id} />
            ))}
          </div>
        )}

        {tab === 'checkin' && (
          <div className="space-y-3">
            <input className={input} placeholder="Booking ID, name, phone or email" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
            {query && !matches.length && data && <p className="font-mono text-sm text-[#52525B]">No booking matches.</p>}
            {matches.map(b => (
              <BookingRow key={b.id} b={b} onCheckin={checkin} busy={busyId === b.id} highlight={b.id === checkinId} />
            ))}
          </div>
        )}

        {tab === 'slots' && data && (
          <div className="space-y-4">
            {data.slots.map(s => {
              const inSlot = data.bookings.filter(b => b.slot === s.number && b.status !== 'REJECTED');
              return (
                <div key={s.number} className="space-y-2">
                  <p className="font-mono text-sm font-bold text-[#030303]">
                    Slot {s.number} · {s.label} <span className="font-normal text-[#52525B]">· {8 - s.seatsLeft}/8 booked</span>
                  </p>
                  {['A', 'B'].map(team => {
                    const side = inSlot.filter(b => b.team === team);
                    if (!side.length) return null;
                    return (
                      <div key={team} className="pl-3 border-l-2 border-[#3300FF] space-y-2">
                        <p className="font-mono text-xs uppercase tracking-widest text-[#3300FF]">Team {team} · {side.reduce((n, b) => n + b.seats, 0)}/4</p>
                        {side.map(b => <BookingRow key={b.id} b={b} onCheckin={checkin} busy={busyId === b.id} />)}
                      </div>
                    );
                  })}
                  {!inSlot.length && <p className="font-mono text-xs text-[#A1A1AA]">No bookings yet.</p>}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'promos' && data && (
          <div className="space-y-6">
            {/* Unexhaustable ambassadors detailed breakdown */}
            <div className="bg-white border border-[#E4E4E7] rounded-lg p-5 space-y-4">
              <div>
                <h3 className="font-sans text-base font-semibold uppercase tracking-wider text-[#030303] flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#3300FF]" /> Ambassador Promocodes (10% Discount · Unexhaustable)
                </h3>
                <p className="font-mono text-xs text-[#52525B]">
                  These promocodes give 10% off and can be redeemed unlimited times by multiple players.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {['DHAIRYA', 'TAKSHH'].map(code => {
                  const p = data.unexhaustablePromos?.find(u => u.code === code) || { totalUses: 0, paidCount: 0, pendingCount: 0, heldCount: 0, revenue: 0, bookings: [] };
                  return (
                    <div key={code} className="border border-[#E4E4E7] rounded-lg p-4 bg-[#FAFAFA] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-bold text-[#030303] px-2.5 py-0.5 bg-white border border-[#E4E4E7] rounded">{code}</span>
                        <span className="font-mono text-xs font-bold text-[#3300FF]">Used {p.totalUses} time{p.totalUses === 1 ? '' : 's'}</span>
                      </div>
                      <div className="font-mono text-xs text-[#52525B] space-y-1">
                        <p>Paid: <strong className="text-[#059669]">{p.paidCount}</strong> · Pending: <strong className="text-[#D97706]">{p.pendingCount}</strong> {p.heldCount > 0 ? `· Active hold: ${p.heldCount}` : ''}</p>
                        <p>Total Revenue: <strong className="text-[#030303]">₹{p.revenue}</strong></p>
                      </div>
                      {p.bookings.length > 0 ? (
                        <div className="border-t border-[#E4E4E7] pt-2 space-y-1.5 max-h-48 overflow-y-auto">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-[#52525B]">Bookings that used this code:</p>
                          {p.bookings.map((b, idx) => (
                            <div key={idx} className="flex items-center justify-between font-mono text-xs p-1.5 bg-white rounded border border-[#E4E4E7]">
                              <div>
                                <span className="font-bold text-[#030303]">{b.leadName}</span>
                                <span className="text-[#52525B] text-[11px] ml-1.5">({b.id})</span>
                              </div>
                              <span className={`text-[11px] font-semibold ${b.status === 'PAID' ? 'text-[#059669]' : b.status === 'PENDING' ? 'text-[#D97706]' : 'text-[#52525B]'}`}>
                                {b.status} · ₹{b.amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="font-mono text-xs text-[#A1A1AA] border-t border-[#E4E4E7] pt-2">No bookings have used this code yet.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All Promo Codes */}
            <div className="bg-white border border-[#E4E4E7] rounded-lg divide-y divide-[#E4E4E7]">
              <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7]">
                <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-[#030303]">
                  All Single-Use & General Promo Codes ({data.promoCodes.length})
                </h3>
              </div>
              {data.promoCodes.map(p => (
                <div key={p.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#030303]">{p.code}</span>
                    {p.isUnexhaustable && (
                      <span className="text-[10px] bg-[#3300FF]/10 text-[#3300FF] px-1.5 py-0.5 rounded font-semibold uppercase">
                        Unexhaustable ({p.totalUses} uses)
                      </span>
                    )}
                  </div>
                  <span className={p.status === 'USED' ? 'text-[#52525B]' : p.status === 'HELD' ? 'text-[#D97706]' : 'text-[#059669]'}>
                    {p.isUnexhaustable
                      ? `${p.totalUses} uses (₹${p.revenue})`
                      : p.status === 'UNUSED'
                      ? 'Unused'
                      : `${p.status === 'USED' ? 'Used' : 'Held'} · ${p.leadName} · ${p.bookingId}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
