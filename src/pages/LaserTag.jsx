import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  CalendarDays, Clock, MapPin, Users, User, Loader2, AlertCircle, CheckCircle2,
  Search, X, Ticket, Copy, Smartphone, Upload, Hourglass, XCircle, Megaphone, Sparkles
} from 'lucide-react';
import { laserTagApi, SUPPORT, safeStorage, compressScreenshot } from '../lib/laserTagApi';

const PRICE_PER_PLAYER = 100;
const PROMO_PERCENT = 10;
const VERIFY_WITHIN = '6 hours';
const ACTIVE_KEY = 'lt_active_booking';
const storage = safeStorage('local');

const MODE_INFO = {
  SOLO: { icon: User, seats: 1, hint: 'Join a team in the slot' },
  TRIO: { icon: Users, seats: 3, hint: 'One solo player fills your 4th spot' },
  SQUAD: { icon: Users, seats: 4, hint: 'A full team side' }
};

const EMPTY_PLAYER = () => ({ name: '', email: '', phone: '', studentId: '' });

const label = 'font-sans text-xs tracking-widest uppercase font-semibold text-[#030303]';
const input =
  'w-full bg-[#F4F4F5] border border-[#E4E4E7] text-[#030303] px-3.5 py-2.5 font-mono text-sm focus:outline-none focus:border-[#3300FF] transition-colors';
const card = 'bg-white border border-[#E4E4E7] rounded-xl';
const primaryBtn =
  'w-full py-4 bg-[#3300FF] hover:bg-[#2900CC] disabled:opacity-50 text-white font-sans text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-2 transition-colors';

function availabilityTag(slot) {
  if (slot.closed) return { text: 'Closed', tone: 'text-[#A1A1AA]' };
  if (slot.seatsLeft === 0) return { text: 'Sold out', tone: 'text-[#A1A1AA]' };
  if (slot.seatsLeft <= 3) return { text: `Filling fast · ${slot.seatsLeft} left`, tone: 'text-[#D97706]' };
  return { text: `${slot.seatsLeft} spots left`, tone: 'text-[#059669]' };
}

function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const left = Math.max(0, until - now);
  return `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
}

function Qr({ value, size = 'w-40 h-40' }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: 260, color: { dark: '#030303', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [value]);
  return src ? <img src={src} alt="QR code" className={size} /> : <div className={`${size} bg-[#F4F4F5]`} />;
}

function SupportLine() {
  return (
    <p className="text-center font-mono text-xs text-[#52525B]">
      Problems? DM <a className="text-[#3300FF]" href={SUPPORT.instagramUrl} target="_blank" rel="noreferrer">{SUPPORT.instagram}</a> or email{' '}
      <a className="text-[#3300FF]" href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a>
    </p>
  );
}

function BookingFacts({ b }) {
  return (
    <div className="grid grid-cols-2 gap-4 content-start">
      <div className="col-span-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#52525B]">Slot {b.slot}</p>
        <p className="font-sans text-xl font-semibold text-[#030303]">{b.slotLabel}</p>
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#52525B]">Team</p>
        <p className="font-sans text-lg font-semibold text-[#3300FF]">Team {b.team}</p>
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#52525B]">Booking</p>
        <p className="font-sans text-lg font-semibold text-[#030303]">{b.modeLabel}</p>
      </div>
      <div className="col-span-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#52525B] mb-1">{b.mode === 'SOLO' ? 'Player' : b.squadName}</p>
        <ul className="font-mono text-sm text-[#030303] space-y-0.5">
          {b.players.map((p, i) => <li key={i}>{i + 1}. {p.name}</li>)}
        </ul>
      </div>
      <div className="col-span-2 flex justify-between border-t border-dashed border-[#E4E4E7] pt-3">
        <span className="font-mono text-sm text-[#52525B]">Amount{b.promoApplied ? ' (promo applied)' : ''}</span>
        <span className="font-mono text-sm font-bold text-[#030303]">₹{b.amount}</span>
      </div>
    </div>
  );
}

function TicketCard({ ticket }) {
  const checkinUrl = `${window.location.origin}/laser-tag/admin?checkin=${ticket.id}`;
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="bg-[#3300FF] text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-widest uppercase opacity-80">Laser Tag · {ticket.event.venue}</p>
          <p className="font-sans font-semibold text-lg">{ticket.event.date}</p>
        </div>
        <CheckCircle2 className="w-7 h-7" />
      </div>
      <div className="p-6 flex flex-col sm:flex-row gap-6">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Qr value={checkinUrl} />
          <p className="font-mono text-sm font-bold text-[#030303] tracking-wider">{ticket.id}</p>
        </div>
        <div className="flex-1"><BookingFacts b={ticket} /></div>
      </div>
      <p className="px-6 pb-5 font-mono text-xs text-[#52525B]">
        Show this QR at the venue, and arrive 5 minutes early. Take a screenshot, or find it again later with “Find my booking”.
      </p>
    </div>
  );
}

function StatusCard({ booking }) {
  if (booking.status === 'PAID') return <TicketCard ticket={booking} />;
  const rejected = booking.status === 'REJECTED';
  return (
    <div className={`${card} p-6 space-y-5`}>
      <div className="flex items-start gap-3">
        {rejected ? <XCircle className="w-7 h-7 text-[#DC2626] shrink-0" /> : <Hourglass className="w-7 h-7 text-[#D97706] shrink-0" />}
        <div>
          <p className="font-sans text-lg font-semibold text-[#030303]">{rejected ? 'Payment not verified' : 'Verifying your payment'}</p>
          <p className="font-mono text-sm text-[#52525B]">
            {rejected
              ? `${booking.rejectionReason || 'We couldn’t match your payment.'} Your seats have been released. If you did pay, contact us with booking ID ${booking.id}.`
              : `We got your UTR and screenshot. Your seats are held, and your ticket will appear here once we check the payment (usually within ${VERIFY_WITHIN}). Come back any time with “Find my booking”.`}
          </p>
        </div>
      </div>
      <p className="font-mono text-sm text-[#030303]">Booking ID: <strong className="tracking-wider">{booking.id}</strong></p>
      <BookingFacts b={booking} />
    </div>
  );
}

function PaymentStep({ booking, onSubmitted }) {
  const left = useCountdown(booking.holdExpiresAt);
  const [utr, setUtr] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { payment } = booking;

  const [selectedAccountId, setSelectedAccountId] = useState(
    payment?.selectedAccount || (booking.slot >= 9 ? 'tanvee' : 'srishti')
  );

  const activeAccount = useMemo(() => {
    if (!payment) return null;
    if (!payment.accounts || !payment.accounts.length) {
      return { upiId: payment.upiId, payee: payment.payee, link: payment.link, id: 'default' };
    }
    const found = payment.accounts.find(a => a.id === selectedAccountId) || payment.accounts[0];
    const q = new URLSearchParams({
      pa: found.upiId,
      pn: found.name,
      am: Number(payment.amount).toFixed(2),
      cu: 'INR',
      tn: payment.note
    });
    return {
      id: found.id,
      upiId: found.upiId,
      payee: found.name,
      slots: found.slots,
      link: `upi://pay?${q.toString().replace(/\+/g, '%20')}`
    };
  }, [payment, selectedAccountId]);

  const lapsed = left === '0:00';

  useEffect(() => {
    if (!file) return setPreview('');
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function copyUpi() {
    if (!activeAccount) return;
    try {
      await navigator.clipboard.writeText(activeAccount.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{12}$/.test(utr)) return setError('The UTR is the 12-digit number in your UPI app’s payment details.');
    if (!file) return setError('Attach a screenshot of the successful payment.');
    setBusy(true);
    try {
      const screenshot = await compressScreenshot(file);
      onSubmitted(await laserTagApi.submitPayment(booking.id, utr, screenshot, activeAccount?.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${card} overflow-hidden`}>
      <div className="px-6 py-4 border-b border-[#E4E4E7] flex flex-wrap items-center justify-between gap-2">
        <h2 className={label}><span className="text-[#3300FF]">05</span> · Pay ₹{payment.amount} by UPI</h2>
        <span className={`font-mono text-xs font-semibold ${lapsed ? 'text-[#DC2626] flex items-center gap-1' : 'text-[#D97706]'}`}>
          {lapsed ? <><AlertCircle className="w-3.5 h-3.5" /> Hold expired (0:00)</> : `Seats held for ${left}`}
        </span>
      </div>

      {payment.accounts && payment.accounts.length > 1 && (
        <div className="px-6 py-3 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-mono text-[#52525B]">
            <span>Payment QR:</span>
            <strong className="text-[#030303]">{activeAccount?.payee}</strong>
          </div>
          <div className="flex items-center gap-2">
            {payment.accounts.map(acc => {
              const active = activeAccount?.id === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`px-3 py-1 font-mono text-xs font-semibold rounded border transition-all ${
                    active
                      ? 'bg-[#3300FF] text-white border-[#3300FF] shadow-sm'
                      : 'bg-white text-[#52525B] hover:text-[#030303] border-[#E4E4E7]'
                  }`}
                >
                  {acc.name.split(' ')[0]} ({acc.slots})
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-6 grid sm:grid-cols-[auto,1fr] gap-6 items-start">
        <div className="flex flex-col items-center gap-2">
          <Qr value={activeAccount?.link || payment.link} size="w-48 h-48" />
          <p className="font-mono text-[11px] text-[#52525B]">Scan with any UPI app</p>
        </div>
        <div className="space-y-3 font-mono text-sm text-[#030303]">
          <a href={activeAccount?.link || payment.link} className="sm:hidden flex items-center justify-center gap-2 w-full py-3 bg-[#030303] text-white font-sans text-xs tracking-widest uppercase font-semibold">
            <Smartphone className="w-4 h-4" /> Open UPI app
          </a>
          <div className="flex justify-between gap-3"><span className="text-[#52525B]">Pay to</span><span className="text-right font-bold">{activeAccount?.payee || payment.payee}</span></div>
          <div className="flex justify-between gap-3 items-center">
            <span className="text-[#52525B]">UPI ID</span>
            <button type="button" onClick={copyUpi} className="flex items-center gap-1.5 font-bold break-all text-right text-[#3300FF]">
              {activeAccount?.upiId || payment.upiId} <Copy className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
          {copied && <p className="text-right text-[11px] text-[#059669]">Copied</p>}
          <div className="flex justify-between gap-3"><span className="text-[#52525B]">Amount</span><span className="font-bold">₹{payment.amount}.00</span></div>
          <div className="flex justify-between gap-3"><span className="text-[#52525B]">Note</span><span className="font-bold tracking-wider">{payment.note}</span></div>
          <p className="text-[11px] text-[#52525B]">Pay the exact amount. If you pay by UPI ID, add the booking ID as the note.</p>
        </div>
      </div>

      <form onSubmit={submit} className="px-6 pb-6 space-y-4 border-t border-[#E4E4E7] pt-5">
        <p className={label}>After paying</p>
        {lapsed && (
          <div className="flex items-start gap-2.5 p-3.5 border border-[#FCA5A5] bg-[#FEF2F2] font-mono text-xs text-[#B91C1C] rounded">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold tracking-wide uppercase text-[#991B1B]">Hold expired (3-minute limit reached)</p>
              <p>
                Your 3-minute seat hold ran out, and these seats have been released back to other players.
              </p>
              <p className="text-[11px] leading-relaxed text-[#7F1D1D]">
                • If you <strong>already completed the UPI payment</strong>, submit your UTR and screenshot anyway — we will seat you if there is room, or refund you.<br />
                • If you <strong>haven’t paid yet</strong>, please do not pay now. Start a new booking instead.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-[#52525B]" htmlFor="utr">12-digit UTR / UPI reference no. *</label>
          <input id="utr" className={input} inputMode="numeric" placeholder="e.g. 431245678901" value={utr} onChange={e => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))} />
        </div>
        <div className="space-y-1.5">
          <span className="font-mono text-xs text-[#52525B]">Payment screenshot *</span>
          <label className="flex items-center gap-3 p-3 border border-dashed border-[#A1A1AA] bg-[#F4F4F5] cursor-pointer hover:border-[#3300FF]">
            {preview ? <img src={preview} alt="Screenshot preview" className="w-14 h-14 object-cover border border-[#E4E4E7]" /> : <Upload className="w-5 h-5 text-[#3300FF]" />}
            <span className="font-mono text-sm text-[#030303] truncate">{file ? file.name : 'Choose screenshot'}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        {error && (
          <div className="flex items-start gap-2 p-3 border border-[#FCA5A5] bg-[#FEF2F2] font-mono text-xs text-[#B91C1C]">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit payment details'}
        </button>
        <p className="font-mono text-[11px] text-[#52525B]">
          We check every payment by hand against our UPI account. Fake or reused UTRs are rejected. Tickets are non-refundable.
        </p>
      </form>
    </section>
  );
}

function FindBooking({ onFound }) {
  const [ref, setRef] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { tickets } = await laserTagApi.lookup(ref, email);
      onFound(tickets);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${card} p-6 space-y-4`}>
      <h2 className={`${label} flex items-center gap-2`}><Search className="w-4 h-4 text-[#3300FF]" /> Find my booking</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={input} placeholder="Booking ID or lead phone" value={ref} onChange={e => setRef(e.target.value)} required />
        <input className={input} type="email" placeholder="Lead player’s email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      {error && <p className="font-mono text-xs text-[#DC2626]">{error}</p>}
      <button type="submit" disabled={busy} className="px-5 py-2.5 bg-[#030303] text-white font-sans text-xs tracking-widest uppercase font-semibold disabled:opacity-50">
        {busy ? 'Searching…' : 'Find booking'}
      </button>
    </form>
  );
}

export default function LaserTag() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [eventData, setEventData] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [slotNumber, setSlotNumber] = useState(null);
  const [mode, setMode] = useState(null);
  const [squadName, setSquadName] = useState('');
  const [players, setPlayers] = useState([EMPTY_PLAYER(), EMPTY_PLAYER(), EMPTY_PLAYER(), EMPTY_PLAYER()]);

  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hold, setHold] = useState(null); // booking awaiting UPI payment
  const [results, setResults] = useState(null); // PENDING / PAID / REJECTED bookings to show
  const [broadcast, setBroadcast] = useState(null);

  useEffect(() => {
    laserTagApi.getAnnouncement().then(msg => {
      if (msg) setBroadcast(msg);
    }).catch(() => {});
  }, []);

  const loadEvent = useCallback(async () => {
    try {
      setEventData(await laserTagApi.getEvent());
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    loadEvent();
    const t = setInterval(loadEvent, 20000);
    return () => clearInterval(t);
  }, [loadEvent]);

  const showBooking = useCallback(booking => {
    if (booking.status === 'HOLD') {
      setHold(booking);
      return;
    }
    setHold(null);
    if (booking.status === 'EXPIRED') {
      storage.remove(ACTIVE_KEY);
      setError(`Your 3-minute hold on booking ${booking.id} ran out, so the seats were released. If you already completed payment, please contact us with your booking ID.`);
      loadEvent();
      return;
    }
    if (booking.status === 'PENDING') storage.set(ACTIVE_KEY, booking.id);
    else storage.remove(ACTIVE_KEY);
    setResults([booking]);
    setSearchParams({ booking: booking.id }, { replace: true });
    window.scrollTo(0, 0);
  }, [loadEvent, setSearchParams]);

  const refresh = useCallback(async id => {
    try {
      showBooking(await laserTagApi.getBooking(id));
    } catch (err) {
      if (err.status === 404) storage.remove(ACTIVE_KEY);
    }
  }, [showBooking]);

  // Resume from the URL or from a booking left open in this browser.
  useEffect(() => {
    const id = searchParams.get('booking') || storage.get(ACTIVE_KEY);
    if (id) refresh(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While verifying, check back so the ticket appears without a reload.
  const pendingId = results?.length === 1 && results[0].status === 'PENDING' ? results[0].id : null;
  useEffect(() => {
    if (!pendingId) return;
    const t = setInterval(() => refresh(pendingId), 30000);
    return () => clearInterval(t);
  }, [pendingId, refresh]);

  const slots = eventData?.slots || [];
  const selectedSlot = slots.find(s => s.number === slotNumber) || null;
  const modes = eventData?.modes || [];
  const seats = mode ? MODE_INFO[mode].seats : 0;

  const pricing = useMemo(() => {
    const base = seats * PRICE_PER_PLAYER;
    const discount = promo ? Math.round((base * PROMO_PERCENT) / 100) : 0;
    return { base, discount, total: base - discount };
  }, [seats, promo]);

  const fits = (s, id) => ({ SOLO: s.canSolo, TRIO: s.canTrio, SQUAD: s.canSquad }[id]);

  function pickSlot(s) {
    setSlotNumber(s.number);
    setError('');
    if (mode && !fits(s, mode)) setMode(null);
  }

  function updatePlayer(i, field, value) {
    setPlayers(prev => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoBusy(true);
    setPromoError('');
    try {
      const res = await laserTagApi.checkPromo(promoInput, mode || 'SOLO');
      setPromo({ code: res.code });
    } catch (err) {
      setPromo(null);
      setPromoError(err.message);
    } finally {
      setPromoBusy(false);
    }
  }

  async function holdSeats(e) {
    e.preventDefault();
    setError('');
    if (!selectedSlot || !mode) return setError('Pick a slot and how many players first.');
    setSubmitting(true);
    try {
      const booking = await laserTagApi.createBooking({
        slot: slotNumber,
        mode,
        squadName,
        players: players.slice(0, seats),
        promoCode: promo?.code || ''
      });
      storage.set(ACTIVE_KEY, booking.id);
      setHold(booking);
      loadEvent();
    } catch (err) {
      setError(err.message);
      loadEvent();
    } finally {
      setSubmitting(false);
    }
  }

  const ev = eventData?.event;

  if (results) {
    const allPaid = results.every(r => r.status === 'PAID');
    return (
      <div className="min-h-screen bg-[#F3F4F6] pt-28 pb-20 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {allPaid && (
            <div className="text-center">
              <p className="font-mono text-xs tracking-widest uppercase text-[#059669] mb-2">Booking confirmed</p>
              <h1 className="font-sans text-3xl sm:text-4xl font-semibold uppercase tracking-wider text-[#3300FF]">You’re in</h1>
            </div>
          )}
          {results.map(b => <StatusCard key={b.id} booking={b} />)}
          <button
            type="button"
            onClick={() => { setResults(null); setSearchParams({}, { replace: true }); loadEvent(); }}
            className="w-full py-3 border border-[#E4E4E7] bg-white font-sans text-xs tracking-widest uppercase font-semibold text-[#030303] hover:border-[#3300FF]"
          >
            Book another slot
          </button>
          <SupportLine />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] pt-28 pb-20 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Broadcast Announcement */}
        {broadcast && (
          <div className="bg-gradient-to-r from-[#3300FF]/10 via-[#00D4FF]/10 to-[#3300FF]/10 border-2 border-[#3300FF] rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 shadow-[0_0_20px_rgba(51,0,255,0.12)]">
            <div className="w-10 h-10 rounded-full bg-[#3300FF] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-md">
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] tracking-widest uppercase bg-[#3300FF] text-white px-2 py-0.5 font-bold rounded">
                  Campus Broadcast
                </span>
                <span className="font-mono text-xs text-[#52525B] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#3300FF]" /> Special Notice
                </span>
              </div>
              <p className="font-sans text-sm sm:text-base font-bold text-[#030303] mt-1.5 leading-snug">
                {broadcast}
              </p>
            </div>
          </div>
        )}

        {/* Event card */}
        <div className={`${card} p-6 sm:p-8`}>
          <p className="font-mono text-xs tracking-widest uppercase text-[#52525B] mb-2">DotSlash × Glitch</p>
          <h1 className="font-sans text-4xl sm:text-5xl font-semibold uppercase tracking-wider text-[#3300FF] mb-5">Laser Tag</h1>
          <div className="grid sm:grid-cols-3 gap-3 font-mono text-sm text-[#030303]">
            <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#3300FF]" /> {ev?.dateLabel || 'Sunday, 2 November 2026'}</span>
            <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#3300FF]" /> {ev?.timeLabel || '8:00 PM – 1:00 AM'}</span>
            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#3300FF]" /> {ev?.venue || 'Learning Commons A&B'}</span>
          </div>
          <p className="font-mono text-sm text-[#52525B] mt-4">
            20-minute slots: a 5-minute briefing, 10 minutes of play and a 5-minute debrief. Two teams of 4 per slot. ₹{PRICE_PER_PLAYER} per player.
          </p>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 p-4 border border-[#FCA5A5] bg-[#FEF2F2] rounded-xl font-mono text-sm text-[#B91C1C]">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {loadError}
          </div>
        )}

        {error && !hold && (
          <div className="flex items-start gap-2 p-4 border border-[#FCA5A5] bg-[#FEF2F2] rounded-xl font-mono text-sm text-[#B91C1C]">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {hold ? (
          <>
            <div className={`${card} p-6`}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className={label}>Your booking · {hold.id}</p>
                <button
                  type="button"
                  onClick={() => { storage.remove(ACTIVE_KEY); setHold(null); loadEvent(); }}
                  className="font-mono text-xs text-[#52525B] underline"
                >
                  Start over
                </button>
              </div>
              <BookingFacts b={hold} />
            </div>
            <PaymentStep booking={hold} onSubmitted={showBooking} />
          </>
        ) : eventData && !eventData.bookingsOpen ? (
          <div className={`${card} p-6 font-mono text-sm text-[#030303]`}>Online booking is closed. Walk-ins are handled at the venue.</div>
        ) : eventData ? (
          <form onSubmit={holdSeats} className="space-y-6">
            {/* 1. Slot */}
            <section className={`${card} p-6`}>
              <h2 className={`${label} mb-4`}><span className="text-[#3300FF]">01</span> · Pick a slot</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slots.map(s => {
                  const tag = availabilityTag(s);
                  const disabled = s.closed || s.seatsLeft === 0;
                  const active = s.number === slotNumber;
                  return (
                    <button
                      key={s.number}
                      type="button"
                      disabled={disabled}
                      onClick={() => pickSlot(s)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        active
                          ? 'border-[#3300FF] bg-[#3300FF]/5 ring-1 ring-[#3300FF]'
                          : disabled
                          ? 'border-[#E4E4E7] bg-[#F4F4F5] cursor-not-allowed'
                          : 'border-[#E4E4E7] bg-white hover:border-[#3300FF]'
                      }`}
                    >
                      <p className={`font-mono text-sm font-bold ${disabled ? 'text-[#A1A1AA]' : 'text-[#030303]'}`}>{s.label}</p>
                      <p className={`font-mono text-[11px] mt-1 ${tag.tone}`}>{tag.text}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Players */}
            <section className={`${card} p-6`}>
              <h2 className={`${label} mb-4`}><span className="text-[#3300FF]">02</span> · How many players?</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {modes.map(m => {
                  const info = MODE_INFO[m.id];
                  const Icon = info.icon;
                  const allowed = !selectedSlot || fits(selectedSlot, m.id);
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!allowed}
                      onClick={() => setMode(m.id)}
                      className={`text-left p-4 rounded-lg border transition-colors ${
                        active
                          ? 'border-[#3300FF] bg-[#3300FF]/5 ring-1 ring-[#3300FF]'
                          : allowed
                          ? 'border-[#E4E4E7] hover:border-[#3300FF]'
                          : 'border-[#E4E4E7] bg-[#F4F4F5] opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 font-sans font-semibold text-[#030303]"><Icon className="w-4 h-4 text-[#3300FF]" /> {m.label}</span>
                        <span className="font-mono text-sm font-bold text-[#030303]">₹{m.price}</span>
                      </div>
                      <p className="font-mono text-[11px] text-[#52525B]">
                        {m.seats} player{m.seats > 1 ? 's' : ''} · {allowed ? info.hint : 'No room in this slot'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. Details */}
            {mode && (
              <section className={`${card} p-6 space-y-5`}>
                <h2 className={label}><span className="text-[#3300FF]">03</span> · Player details</h2>
                {seats > 1 && (
                  <div className="space-y-1.5">
                    <label className="font-mono text-xs text-[#52525B]" htmlFor="squad">Squad name *</label>
                    <input id="squad" className={input} required maxLength={40} value={squadName} onChange={e => setSquadName(e.target.value)} placeholder="e.g. Neon Vipers" />
                  </div>
                )}
                {players.slice(0, seats).map((p, i) => (
                  <div key={i} className={`space-y-3 ${i > 0 ? 'pt-4 border-t border-[#E4E4E7]' : ''}`}>
                    <p className="font-mono text-xs uppercase tracking-widest text-[#3300FF]">
                      {i === 0 ? (seats > 1 ? 'Player 1 · Lead (payment contact)' : 'Your details') : `Player ${i + 1}`}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input className={input} required placeholder="Full name *" value={p.name} onChange={e => updatePlayer(i, 'name', e.target.value)} />
                      <input className={input} required type="email" placeholder="FLAME email *" value={p.email} onChange={e => updatePlayer(i, 'email', e.target.value)} />
                      <input
                        className={input}
                        required={i === 0}
                        type="tel"
                        inputMode="numeric"
                        placeholder={i === 0 ? "10-digit phone *" : "10-digit phone (optional)"}
                        value={p.phone}
                        onChange={e => updatePlayer(i, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                      <input className={input} placeholder="Student ID (optional)" value={p.studentId} onChange={e => updatePlayer(i, 'studentId', e.target.value)} />
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* 4. Summary */}
            {mode && selectedSlot && (
              <section className={`${card} p-6 space-y-4`}>
                <h2 className={label}><span className="text-[#3300FF]">04</span> · Summary</h2>
                <div className="font-mono text-sm text-[#030303] space-y-2">
                  <div className="flex justify-between gap-3"><span className="text-[#52525B]">Slot</span><span>{selectedSlot.label}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#52525B]">{modes.find(m => m.id === mode)?.label} · {seats} × ₹{PRICE_PER_PLAYER}</span><span>₹{pricing.base}</span></div>
                  {promo && (
                    <div className="flex justify-between gap-3 text-[#059669]">
                      <span className="flex items-center gap-2">Promo {promo.code}
                        <button type="button" aria-label="Remove promo" onClick={() => setPromo(null)}><X className="w-3.5 h-3.5" /></button>
                      </span>
                      <span>−₹{pricing.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#E4E4E7] pt-2 text-base font-bold"><span>Total</span><span>₹{pricing.total}</span></div>
                </div>

                {!promo && (
                  <div>
                    <div className="flex gap-2">
                      <input
                        className={`${input} uppercase`}
                        placeholder="Promo code"
                        value={promoInput}
                        onChange={e => { setPromoInput(e.target.value); setPromoError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } }}
                      />
                      <button type="button" onClick={applyPromo} disabled={promoBusy || !promoInput.trim()} className="px-5 border border-[#030303] font-sans text-xs tracking-widest uppercase font-semibold text-[#030303] disabled:opacity-40">
                        {promoBusy ? '…' : 'Apply'}
                      </button>
                    </div>
                    {promoError && <p className="font-mono text-xs text-[#DC2626] mt-1.5">{promoError}</p>}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 border border-[#FCA5A5] bg-[#FEF2F2] font-mono text-xs text-[#B91C1C]">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}

                <button type="submit" disabled={submitting} className={primaryBtn}>
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Holding your seats…</> : <><Ticket className="w-4 h-4" /> Continue to pay ₹{pricing.total}</>}
                </button>
                <p className="font-mono text-[11px] text-[#52525B]">
                  Next you pay by UPI and upload your UTR and screenshot. Seats are held for 3 minutes while you complete payment.
                </p>
              </section>
            )}

            {error && !(mode && selectedSlot) && (
              <div className="flex items-start gap-2 p-3 border border-[#FCA5A5] bg-[#FEF2F2] font-mono text-xs text-[#B91C1C]">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
          </form>
        ) : (
          !loadError && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#3300FF]" /></div>
        )}

        {!hold && <FindBooking onFound={found => { setResults(found); window.scrollTo(0, 0); }} />}
        <SupportLine />
      </div>
    </div>
  );
}
