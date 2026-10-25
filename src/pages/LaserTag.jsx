import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Smartphone,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  UserCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { db } from '../lib/db';

const MERCHANT_CONFIG = {
  appName: 'YOUPI PG',
  payeeName: 'DotSlash X Glitch',
  upiId: 'hridaygoyal2000@oksbi',
  primaryColor: '#2563eb',
};

const TIERS = [
  {
    id: 'solo',
    label: 'Solo Combatant Pool',
    subtitle: '1 Player • Drafted into 4v4 Squad',
    amount: 100,
  },
  {
    id: 'squad3',
    label: '3-Player Tactical Squad',
    subtitle: '3 Players • 20-Min Arena Slot',
    amount: 300,
  },
  {
    id: 'squad4',
    label: '4-Player Full Squad',
    subtitle: '4 Players • Full Team Lock',
    amount: 400,
  },
];

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5:00 YouPI active payment window

async function ensureYoupiTable() {
  if (!db) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS youpi_sessions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      tier_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      upi_uri TEXT NOT NULL,
      utr TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function generateOrderId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `YPG-${code}`;
}

export default function LaserTag() {
  const [searchParams] = useSearchParams();

  // Resolve initial tier from ?tier= or ?amount= query params
  const initialTier = (() => {
    const qTier = (searchParams.get('tier') || '').toLowerCase();
    const qAmount = Number(searchParams.get('amount'));
    if (qTier) {
      const found = TIERS.find((t) => t.id === qTier);
      if (found) return found.id;
    }
    if (qAmount) {
      const found = TIERS.find((t) => t.amount === qAmount);
      if (found) return found.id;
    }
    return 'squad4';
  })();

  const [selectedTierId, setSelectedTierId] = useState(initialTier);
  const selectedTier = TIERS.find((t) => t.id === selectedTierId) || TIERS[2];

  // Customer identity state (persisted in localStorage like YouPI Berry Auth)
  const [name, setName] = useState(() => localStorage.getItem('youpi_cust_name') || '');
  const [email, setEmail] = useState(() => localStorage.getItem('youpi_cust_email') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('youpi_cust_phone') || '');

  // Session state: 'IDENTIFY' | 'QUEUED' | 'ACTIVE' | 'VERIFYING' | 'SUCCESS' | 'EXPIRED'
  const [step, setStep] = useState('IDENTIFY');
  const [session, setSession] = useState(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [remainingMs, setRemainingMs] = useState(ACTIVE_WINDOW_MS);
  const [utr, setUtr] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(''), 2000);
  };

  // Sweep expired sessions & check queue position
  const syncQueueState = useCallback(async (currentSession) => {
    if (!db || !currentSession) return;
    try {
      const now = Date.now();
      await db.execute(
        `UPDATE youpi_sessions SET status = 'EXPIRED' WHERE status IN ('ACTIVE', 'QUEUED') AND expires_at <= ?`,
        [now]
      );

      // Find all currently waiting/active sessions ordered by creation time
      const res = await db.execute(
        `SELECT id, status, expires_at FROM youpi_sessions WHERE status IN ('ACTIVE', 'QUEUED') ORDER BY created_at ASC`
      );
      const rows = res.rows || [];
      const idx = rows.findIndex((r) => r.id === currentSession.id);

      if (idx === -1) {
        setStep('EXPIRED');
        return;
      }

      if (idx === 0) {
        // First in single-slot FIFO queue -> promote to ACTIVE
        if (currentSession.status !== 'ACTIVE') {
          const newExpiry = Date.now() + ACTIVE_WINDOW_MS;
          await db.execute(`UPDATE youpi_sessions SET status = 'ACTIVE', expires_at = ? WHERE id = ?`, [
            newExpiry,
            currentSession.id,
          ]);
          setSession((prev) => (prev ? { ...prev, status: 'ACTIVE', expires_at: newExpiry } : prev));
        }
        setQueuePosition(0);
        setStep('ACTIVE');
      } else {
        setQueuePosition(idx);
        setStep('QUEUED');
      }
    } catch (err) {
      console.warn('Queue sync fallback:', err);
    }
  }, []);

  // Poll queue every 3 seconds when QUEUED
  useEffect(() => {
    if (step !== 'QUEUED' || !session) return;
    const interval = setInterval(() => {
      syncQueueState(session);
    }, 3000);
    return () => clearInterval(interval);
  }, [step, session, syncQueueState]);

  // 1-second countdown timer when ACTIVE
  useEffect(() => {
    if (step !== 'ACTIVE' || !session) return;
    const interval = setInterval(() => {
      const left = Math.max(0, session.expires_at - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        setStep('EXPIRED');
        if (db) {
          db.execute(`UPDATE youpi_sessions SET status = 'EXPIRED' WHERE id = ?`, [session.id]).catch(() => {});
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [step, session]);

  const handleStartCheckout = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    if (!cleanName || !cleanEmail || cleanPhone.length < 10) {
      setError('Please enter your full name, email address, and a valid 10-digit WhatsApp/mobile number.');
      return;
    }

    localStorage.setItem('youpi_cust_name', cleanName);
    localStorage.setItem('youpi_cust_email', cleanEmail);
    localStorage.setItem('youpi_cust_phone', cleanPhone);

    setLoading(true);
    try {
      await ensureYoupiTable();
      const now = Date.now();
      const sessionId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `sess_${now}_${Math.random().toString(36).slice(2)}`;
      const orderId = generateOrderId();
      const note = `${orderId} ${selectedTier.label}`;
      const upiUri = `upi://pay?pa=${encodeURIComponent(
        MERCHANT_CONFIG.upiId
      )}&pn=${encodeURIComponent(MERCHANT_CONFIG.payeeName)}&am=${selectedTier.amount}.00&cu=INR&tn=${encodeURIComponent(
        note
      )}`;
      const expiresAt = now + ACTIVE_WINDOW_MS;

      let assignedStatus = 'ACTIVE';
      let pos = 0;

      if (db) {
        await db.execute(
          `UPDATE youpi_sessions SET status = 'EXPIRED' WHERE status IN ('ACTIVE', 'QUEUED') AND expires_at <= ?`,
          [now]
        );
        const activeRes = await db.execute(
          `SELECT id FROM youpi_sessions WHERE status IN ('ACTIVE', 'QUEUED') ORDER BY created_at ASC`
        );
        const activeCount = (activeRes.rows || []).length;
        if (activeCount > 0) {
          assignedStatus = 'QUEUED';
          pos = activeCount;
        }

        await db.execute(
          `INSERT INTO youpi_sessions (id, order_id, customer_name, customer_email, customer_phone, tier_id, amount, upi_uri, status, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionId,
            orderId,
            cleanName,
            cleanEmail,
            cleanPhone,
            selectedTier.id,
            selectedTier.amount,
            upiUri,
            assignedStatus,
            expiresAt,
          ]
        );
      }

      const newSession = {
        id: sessionId,
        order_id: orderId,
        customer_name: cleanName,
        customer_email: cleanEmail,
        customer_phone: cleanPhone,
        tier: selectedTier,
        amount: selectedTier.amount,
        upi_uri: upiUri,
        status: assignedStatus,
        expires_at: expiresAt,
      };

      setSession(newSession);
      setRemainingMs(ACTIVE_WINDOW_MS);
      setQueuePosition(pos);
      setStep(assignedStatus);
    } catch (err) {
      console.error('Checkout init error:', err);
      setError('Could not initialize payment session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUtr = async (e) => {
    e.preventDefault();
    setError('');
    const cleanUtr = utr.replace(/\D/g, '');
    if (cleanUtr.length !== 12) {
      setError('Please enter a valid 12-digit UPI UTR / Bank Reference number from your payment app.');
      return;
    }

    setStep('VERIFYING');
    try {
      if (db && session) {
        // Check duplicate UTR
        const dup = await db.execute(
          `SELECT order_id FROM youpi_sessions WHERE utr = ? AND status = 'SUCCESS' AND id != ?`,
          [cleanUtr, session.id]
        );
        if (dup.rows && dup.rows.length > 0) {
          setStep('ACTIVE');
          setError('This 12-digit UTR has already been used for another order.');
          return;
        }

        await db.execute(`UPDATE youpi_sessions SET utr = ?, status = 'SUCCESS' WHERE id = ?`, [
          cleanUtr,
          session.id,
        ]);
      }

      setTimeout(() => {
        setSession((prev) => (prev ? { ...prev, utr: cleanUtr, status: 'SUCCESS' } : prev));
        setStep('SUCCESS');
      }, 1200);
    } catch (err) {
      console.error('UTR verification error:', err);
      setSession((prev) => (prev ? { ...prev, utr: cleanUtr, status: 'SUCCESS' } : prev));
      setStep('SUCCESS');
    }
  };

  const handleCancelOrReset = async () => {
    if (db && session?.id && session.status !== 'SUCCESS') {
      db.execute(`UPDATE youpi_sessions SET status = 'CANCELLED' WHERE id = ?`, [session.id]).catch(() => {});
    }
    setSession(null);
    setUtr('');
    setError('');
    setStep('IDENTIFY');
  };

  const formatTimer = (ms) => {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-white pt-24 pb-20 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top YouPI PG Header */}
        <div className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center font-bold text-lg tracking-wider">
              YP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-blue-200 font-semibold">
                  {MERCHANT_CONFIG.appName}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                  0% FEE DIRECT UPI
                </span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                {MERCHANT_CONFIG.payeeName}
              </h1>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono uppercase text-blue-200 block">Amount Payable</span>
            <span className="text-2xl font-extrabold text-white">₹{selectedTier.amount}.00</span>
          </div>
        </div>

        {/* Main Body */}
        <div className="p-6 space-y-6">
          {/* STEP 1: IDENTIFY & SELECT TIER */}
          {step === 'IDENTIFY' && (
            <form onSubmit={handleStartCheckout} className="space-y-5">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-2">
                  1. Select Laser Tag Registration Tier
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {TIERS.map((tier) => {
                    const active = tier.id === selectedTierId;
                    return (
                      <button
                        type="button"
                        key={tier.id}
                        onClick={() => setSelectedTierId(tier.id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                          active
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)]'
                            : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            <span>{tier.label}</span>
                            {active && (
                              <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-mono">
                                SELECTED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{tier.subtitle}</p>
                        </div>
                        <span className="text-lg font-bold font-mono text-white">₹{tier.amount}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <label className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                  2. Combatant / Squad Captain Identity
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full Name (same as Google Form)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                />
                <input
                  type="email"
                  required
                  placeholder="FLAME Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                />
                <input
                  type="tel"
                  required
                  placeholder="10-Digit WhatsApp / Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                <strong className="text-slate-200">Note:</strong> All registrations and slot fees are strictly
                non-refundable. After paying here, copy your generated <strong>Order ID &amp; UTR</strong> into the
                Google Form.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2563eb] hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
              >
                <span>{loading ? 'Entering Single-Slot Queue...' : `Proceed to Pay ₹${selectedTier.amount}.00`}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* STEP 2: QUEUED IN SINGLE-SLOT FIFO QUEUE */}
          {step === 'QUEUED' && session && (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-400 mx-auto flex items-center justify-center animate-pulse">
                <Clock size={26} />
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
                  Single-Slot FIFO Queue Active
                </span>
                <h2 className="text-xl font-bold mt-1">Queue Position: #{queuePosition}</h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  To guarantee deterministic UPI attribution on <code className="text-slate-200">{MERCHANT_CONFIG.upiId}</code>,
                  only one combatant pays at a time. You will be promoted automatically!
                </p>
              </div>
              <button
                type="button"
                onClick={() => syncQueueState(session)}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-400 hover:text-blue-300"
              >
                <RefreshCw size={13} />
                <span>Refresh Queue Status</span>
              </button>
            </div>
          )}

          {/* STEP 3: ACTIVE PAYMENT SESSION (QR + 5:00 TIMER) */}
          {step === 'ACTIVE' && session && (
            <div className="space-y-5">
              {/* Order & Countdown Bar */}
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Order ID</span>
                  <span className="text-sm font-mono font-bold text-white">{session.order_id}</span>
                </div>
                <div className="flex items-center gap-2 text-amber-400 font-mono text-sm font-bold">
                  <Clock size={15} />
                  <span>{formatTimer(remainingMs)}</span>
                </div>
              </div>

              {/* Vector SVG QR Code Card */}
              <div className="bg-white rounded-2xl p-5 flex flex-col items-center text-slate-900 shadow-inner">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Scan with GPay • PhonePe • Paytm • BHIM
                </div>
                <div className="p-2 bg-white border-2 border-slate-100 rounded-xl">
                  <QRCodeSVG value={session.upi_uri} size={200} level="M" includeMargin={false} />
                </div>
                <div className="mt-3 flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-700">
                  <span>{MERCHANT_CONFIG.upiId}</span>
                  <button
                    type="button"
                    onClick={() => copyText(MERCHANT_CONFIG.upiId, 'upi')}
                    className="text-blue-600 hover:text-blue-800 font-sans font-semibold flex items-center gap-1"
                  >
                    {copiedField === 'upi' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedField === 'upi' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Mobile Deep Link */}
                <a
                  href={session.upi_uri}
                  className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 sm:hidden"
                >
                  <Smartphone size={14} />
                  <span>Open in UPI App (₹{session.amount})</span>
                </a>
              </div>

              {/* 12-Digit UTR Input */}
              <form onSubmit={handleConfirmUtr} className="space-y-3">
                <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block">
                  Enter 12-Digit UPI UTR / Reference No.
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  required
                  placeholder="e.g. 429518392014 (12 digits)"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-3 text-base font-mono tracking-widest text-white outline-none"
                />

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelOrReset}
                    className="px-4 py-3 rounded-xl border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={17} />
                    <span>Verify Payment (₹{session.amount})</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 4: VERIFYING (0:30 Dual Timer) */}
          {step === 'VERIFYING' && (
            <div className="text-center py-10 space-y-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-lg font-bold">Verifying UPI Settlement...</h3>
              <p className="text-xs text-slate-400">
                Recording your 12-digit UTR &amp; releasing the single-slot queue for the next combatant.
              </p>
            </div>
          )}

          {/* STEP 5: SUCCESS RECEIPT FOR GOOGLE FORM */}
          {step === 'SUCCESS' && session && (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 size={30} />
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 block">
                  YouPI Payment Recorded
                </span>
                <h2 className="text-xl font-bold text-white">₹{session.amount}.00 Confirmed</h2>
                <p className="text-xs text-slate-400">
                  Copy your verification code below and paste it into the Google Form to complete your squad
                  registration!
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Verification Code:</span>
                  <span className="text-emerald-400 font-bold">
                    {session.order_id} | UTR: {session.utr}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tier:</span>
                  <span className="text-white">{session.tier.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Combatant:</span>
                  <span className="text-white">{session.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">UPI VPA:</span>
                  <span className="text-white">{MERCHANT_CONFIG.upiId}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyText(`${session.order_id} | UTR-${session.utr}`, 'receipt')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg"
              >
                {copiedField === 'receipt' ? <Check size={16} /> : <Copy size={16} />}
                <span>
                  {copiedField === 'receipt'
                    ? 'Copied Verification Code!'
                    : `Copy "${session.order_id} | UTR-${session.utr}" for Google Form`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCancelOrReset}
                className="w-full text-center text-xs font-mono text-slate-400 hover:text-white pt-1"
              >
                Start Another Payment
              </button>
            </div>
          )}

          {/* STEP 6: EXPIRED */}
          {step === 'EXPIRED' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-400 mx-auto flex items-center justify-center">
                <Clock size={24} />
              </div>
              <h3 className="text-lg font-bold">5:00 Payment Window Expired</h3>
              <p className="text-xs text-slate-400">
                Your single-slot queue window elapsed so the next customer could pay. Click below to re-enter.
              </p>
              <button
                type="button"
                onClick={handleCancelOrReset}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl"
              >
                Re-enter Checkout Queue
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Lock size={12} className="text-emerald-400" />
            <span>YouPI PG • Single-Slot FIFO Engine</span>
          </div>
          <span>{MERCHANT_CONFIG.upiId}</span>
        </div>
      </div>
    </div>
  );
}
