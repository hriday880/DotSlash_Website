import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  Users,
  Maximize2,
  X,
  RefreshCw,
  AlertCircle,
  Check,
  Mail,
  Copy,
  Send,
  Crosshair,
} from 'lucide-react';
import { laserTagApi } from '../lib/laserTagApi';

export function generateLaserTagEmail(registration, type = 'APPROVE', adminNote = '') {
  const isApprove = type === 'APPROVE';
  const captain = registration.captain_name || 'Captain';
  const email = registration.captain_email || '';
  const slotWindow = registration.time_window || registration.slot_id;
  const team = registration.team || 'Team A';
  const regId = registration.registration_id || '';
  const count = registration.player_count || 1;
  const total = registration.total_fee || count * 100;

  const playersList =
    registration.players && registration.players.length > 0
      ? registration.players
          .map((p, i) => `  ${i + 1}. ${p.name} (${p.phone || 'No phone'}) - ${p.email || ''}`)
          .join('\n')
      : `  1. ${captain} (${registration.captain_phone || ''}) - ${email}`;

  if (isApprove) {
    const subject = `[DotSlash] Laser Tag Booking CONFIRMED – ${slotWindow} (${team})`;
    const body = `Hi ${captain},

Great news! Your payment screenshot for the DotSlash Laser Tag Arena (October 22, 2026) has been VERIFIED and your slot is officially CONFIRMED!

=== BOOKING RECEIPT ===
Registration ID : ${regId}
Slot Time       : ${slotWindow}
Team Side       : ${team}
Squad Size      : ${count} Player(s)
Total Fee Paid  : ₹${total} (VERIFIED & APPROVED)

=== SQUAD ROSTER ===
${playersList}

=== IMPORTANT EVENT INSTRUCTIONS ===
• Venue: DotSlash Laser Tag Arena, FLAME University Campus.
• Arrival: Please report at least 10 minutes prior to your slot time (${slotWindow}) for sensor calibration, vest fitting, and tactical briefing.
• Format: 4v4 continuous 10-minute skirmish.
• Live Status Receipt: You can check or verify your booking anytime at ${window.location.origin}/laser-tag using your Registration ID: ${regId}.

If you have any questions or require squad adjustments, simply reply directly to this email.

Gear up and see you in the arena!

Best regards,
DotSlash Team
FLAME University`;

    return { subject, body, recipient: email };
  } else {
    const subject = `[DotSlash] Laser Tag Booking Notice – Registration ${regId}`;
    const noteText = adminNote ? `\nReason / Note from Admin:\n"${adminNote}"\n` : '';
    const body = `Hi ${captain},

Thank you for registering for the DotSlash Laser Tag Arena (October 22, 2026).

Unfortunately, our verification team was unable to approve your booking for Registration ID: ${regId} (${slotWindow}, ${team}).
${noteText}
As a result, your provisionally held spots have been released back into the open pool.

Next Steps:
1. If you would like to re-register with a clear payment screenshot or pick a different slot, please visit:
   ${window.location.origin}/laser-tag
2. If your account was already debited, please reply directly to this email with your bank statement or UPI transaction reference so we can verify and resolve this for you immediately.

Best regards,
DotSlash Team
FLAME University`;

    return { subject, body, recipient: email };
  }
}

export default function LaserTagAdminSection() {
  const [registrations, setRegistrations] = useState([]);
  const [kpis, setKpis] = useState({
    totalSlots: 36,
    confirmedPlayers: 0,
    pendingPlayers: 0,
    approvedRevenue: 0,
    pendingRevenue: 0,
  });

  const [filter, setFilter] = useState('PENDING_VERIFICATION');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lightbox state for screenshot
  const [lightboxImage, setLightboxImage] = useState(null);

  // Admin notes state
  const [notes, setNotes] = useState({});
  const [actionInProgress, setActionInProgress] = useState({});
  const [actionMessage, setActionMessage] = useState({ text: '', type: '' });

  // Email modal state
  const [emailModal, setEmailModal] = useState({
    isOpen: false,
    type: 'APPROVE', // 'APPROVE' | 'REJECT'
    registration: null,
    subject: '',
    body: '',
    recipient: '',
  });

  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await laserTagApi.getAdminRegistrations(filter);
      setRegistrations(data.registrations || []);
      if (data.kpis) setKpis(data.kpis);

      const initialNotes = {};
      (data.registrations || []).forEach((r) => {
        initialNotes[r.registration_id] = r.admin_note || '';
      });
      setNotes((prev) => ({ ...initialNotes, ...prev }));
    } catch (err) {
      console.error('Failed to load laser tag registrations:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 20000);
    return () => clearInterval(interval);
  }, [filter]);

  const handleAction = async (registration, action) => {
    const regId = registration.registration_id;
    const note = notes[regId] || '';
    setActionInProgress((prev) => ({ ...prev, [regId]: action }));
    setActionMessage({ text: '', type: '' });

    try {
      await laserTagApi.updateAdminRegistration(regId, {
        action,
        adminNote: note,
      });

      setActionMessage({
        text: `Registration ${regId} has been ${action === 'APPROVE' ? 'APPROVED (Slot Locked)' : 'REJECTED (Held spots freed)'}. Ready-to-send email generated below.`,
        type: action === 'APPROVE' ? 'success' : 'warning',
      });

      // Automatically open Email Modal with pre-filled template
      const emailContent = generateLaserTagEmail(registration, action, note);
      setEmailModal({
        isOpen: true,
        type: action,
        registration,
        subject: emailContent.subject,
        body: emailContent.body,
        recipient: emailContent.recipient,
      });

      await loadData();
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
      setActionMessage({
        text: `Failed to ${action.toLowerCase()} registration: ${err.message}`,
        type: 'error',
      });
    } finally {
      setActionInProgress((prev) => {
        const next = { ...prev };
        delete next[regId];
        return next;
      });
    }
  };

  const handleOpenEmailModal = (registration, type = 'APPROVE') => {
    const note = notes[registration.registration_id] || registration.admin_note || '';
    const emailContent = generateLaserTagEmail(registration, type, note);
    setEmailModal({
      isOpen: true,
      type,
      registration,
      subject: emailContent.subject,
      body: emailContent.body,
      recipient: emailContent.recipient,
    });
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(emailModal.body);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleCopyFull = () => {
    const fullText = `To: ${emailModal.recipient}\nSubject: ${emailModal.subject}\n\n${emailModal.body}`;
    navigator.clipboard.writeText(fullText);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  const filteredRegistrations = registrations.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.registration_id?.toLowerCase().includes(term) ||
      r.captain_name?.toLowerCase().includes(term) ||
      r.captain_email?.toLowerCase().includes(term) ||
      r.captain_phone?.includes(term) ||
      r.utr_reference?.toLowerCase().includes(term) ||
      r.slot_id?.includes(term) ||
      r.team?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 bg-[#0e0e0e] border border-[#252525]">
          <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Total Event Slots</span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">
            {kpis.totalSlots}
            <span className="text-xs font-normal text-[#71717A] ml-1">(288 spots)</span>
          </span>
        </div>

        <div className="p-3.5 bg-[#0e0e0e] border border-emerald-900/40">
          <span className="text-[10px] font-mono uppercase text-emerald-400 block">Confirmed Players</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
            {kpis.confirmedPlayers}
            <span className="text-xs font-normal text-emerald-600 ml-1">approved</span>
          </span>
        </div>

        <div className="p-3.5 bg-[#0e0e0e] border border-amber-900/40">
          <span className="text-[10px] font-mono uppercase text-amber-400 block">Pending Verification</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
            {kpis.pendingPlayers}
            <span className="text-xs font-normal text-amber-600 ml-1">held</span>
          </span>
        </div>

        <div className="p-3.5 bg-[#0e0e0e] border border-[#3300FF]/40">
          <span className="text-[10px] font-mono uppercase text-[#00D4FF] block">Approved Revenue</span>
          <span className="text-xl font-bold font-mono text-[#00D4FF] mt-1 block">
            ₹{kpis.approvedRevenue}
          </span>
        </div>

        <div className="p-3.5 bg-[#0e0e0e] border border-[#353535] col-span-2 md:col-span-1">
          <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Pending Revenue</span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">
            ₹{kpis.pendingRevenue}
          </span>
        </div>
      </div>

      {/* Action Notice */}
      {actionMessage.text && (
        <div
          className={`p-3 font-mono text-xs border flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
              : actionMessage.type === 'warning'
              ? 'bg-amber-950/60 border-amber-600 text-amber-300'
              : 'bg-red-950/60 border-red-600 text-red-300'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage({ text: '', type: '' })}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0d0d0d] p-3 border border-[#252525]">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: 'PENDING_VERIFICATION', label: 'Pending Review' },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'REJECTED', label: 'Rejected' },
            { id: 'ALL', label: 'All' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors whitespace-nowrap border ${
                filter === t.id
                  ? 'bg-[#1b1b1b] border-[#3300FF] text-white font-bold'
                  : 'border-transparent text-[#71717A] hover:text-white'
              }`}
            >
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-3 top-2.5 text-[#71717A]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ID, Captain, UTR..."
              className="w-full bg-[#050505] border border-[#303030] pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-[#555] focus:border-[#3300FF] outline-none"
            />
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 bg-[#151515] border border-[#353535] hover:border-white text-[#A0A0A0] hover:text-white transition-colors"
            title="Refresh list"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-[#00D4FF]' : ''} />
          </button>
        </div>
      </div>

      {/* Registrations List */}
      {loading ? (
        <div className="p-12 text-center font-mono text-xs text-[#A0A0A0] bg-[#0c0c0c] border border-[#202020]">
          <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#3300FF]" />
          <span>Loading registrations...</span>
        </div>
      ) : filteredRegistrations.length === 0 ? (
        <div className="p-12 text-center font-mono text-xs text-[#71717A] bg-[#0c0c0c] border border-[#202020]">
          <Shield size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-white font-semibold mb-1">No Registrations Found</p>
          <p>
            {filter === 'PENDING_VERIFICATION'
              ? 'No registrations are currently awaiting payment screenshot review.'
              : 'No records match the current filter or search criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRegistrations.map((reg) => {
            const isPending = reg.payment_status === 'PENDING_VERIFICATION';
            const isApproved = reg.payment_status === 'APPROVED';
            const isRejected = reg.payment_status === 'REJECTED';
            const inProgress = actionInProgress[reg.registration_id];

            return (
              <div
                key={reg.registration_id}
                className={`bg-[#0c0c0c] border transition-all ${
                  isPending
                    ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.06)]'
                    : isApproved
                    ? 'border-emerald-500/40'
                    : 'border-[#252525] opacity-80'
                }`}
              >
                {/* Header */}
                <div className="p-4 border-b border-[#202020] bg-[#121212] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold text-xs text-[#00D4FF]">
                      {reg.registration_id}
                    </span>

                    <span
                      className={`px-2 py-0.5 font-mono text-[10px] uppercase font-bold border ${
                        reg.team === 'Team A'
                          ? 'bg-[#3300FF]/20 border-[#3300FF]/50 text-[#9966FF]'
                          : 'bg-[#FF0066]/20 border-[#FF0066]/50 text-[#FF0066]'
                      }`}
                    >
                      {reg.team}
                    </span>

                    <span className="px-2 py-0.5 bg-[#1f1f1f] border border-[#353535] text-[10px] font-mono text-white flex items-center gap-1">
                      <Clock size={11} className="text-[#3300FF]" />
                      <span>{reg.time_window}</span>
                    </span>

                    <span className="text-[10px] font-mono text-[#71717A]">
                      {reg.created_at}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Pill */}
                    {isPending && (
                      <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-[11px] uppercase font-bold flex items-center gap-1">
                        <Clock size={11} className="animate-spin" />
                        <span>Pending Review</span>
                      </span>
                    )}
                    {isApproved && (
                      <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono text-[11px] uppercase font-bold flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        <span>Approved & Locked</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-2.5 py-0.5 bg-red-500/20 border border-red-500/50 text-red-300 font-mono text-[11px] uppercase font-bold flex items-center gap-1">
                        <XCircle size={11} />
                        <span>Rejected (Freed)</span>
                      </span>
                    )}

                    {/* Email Action Pill */}
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenEmailModal(
                          reg,
                          isRejected ? 'REJECT' : 'APPROVE'
                        )
                      }
                      className="px-2.5 py-0.5 bg-[#1a1a1a] hover:bg-[#3300FF] border border-[#353535] text-white font-mono text-[11px] uppercase flex items-center gap-1 transition-colors"
                      title="View/Copy Email Template"
                    >
                      <Mail size={11} />
                      <span>Email Template</span>
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Screenshot Thumbnail */}
                  <div className="lg:col-span-3 bg-[#141414] border border-[#2a2a2a] p-3 text-center">
                    <span className="block text-[9px] font-mono uppercase text-[#A0A0A0] mb-1.5 text-left flex items-center justify-between">
                      <span>Screenshot</span>
                      <span className="text-[#71717A]">Click to inspect</span>
                    </span>

                    {reg.screenshot_url ? (
                      <div
                        onClick={() => setLightboxImage(reg.screenshot_url)}
                        className="relative group cursor-pointer border border-[#333] overflow-hidden bg-black max-h-40 flex items-center justify-center"
                      >
                        <img
                          src={reg.screenshot_url}
                          alt="Screenshot"
                          className="w-full h-auto max-h-40 object-contain group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-mono text-[10px] gap-1">
                          <Maximize2 size={13} />
                          <span>Inspect Fullscreen</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-28 bg-[#080808] flex items-center justify-center font-mono text-xs text-red-400">
                        No screenshot
                      </div>
                    )}

                    <div className="mt-2 text-left font-mono text-[11px]">
                      <span className="text-[9px] text-[#71717A] uppercase block">UTR / Ref:</span>
                      <span className="font-semibold text-white break-all">
                        {reg.utr_reference || 'None provided'}
                      </span>
                    </div>
                  </div>

                  {/* Squad Info */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="p-2.5 bg-[#111111] border border-[#222]">
                      <span className="text-[9px] font-mono uppercase text-[#00D4FF] block">
                        Captain Contact
                      </span>
                      <div className="font-mono text-xs mt-0.5 space-y-0.5">
                        <p className="text-white font-bold">{reg.captain_name}</p>
                        <p className="text-[#A0A0A0] text-[11px]">
                          {reg.captain_email} • {reg.captain_phone}
                        </p>
                      </div>
                    </div>

                    <div className="border border-[#222] bg-[#0c0c0c]">
                      <div className="px-2.5 py-1.5 bg-[#171717] border-b border-[#222] flex items-center justify-between text-[9px] font-mono uppercase text-[#A0A0A0]">
                        <span>Roster ({reg.player_count} Players)</span>
                        <span className="text-emerald-400 font-bold">₹{reg.total_fee} Total</span>
                      </div>
                      <div className="divide-y divide-[#1c1c1c] font-mono text-[11px]">
                        {reg.players?.map((p) => (
                          <div key={p.player_number} className="p-2 flex items-center justify-between">
                            <div>
                              <span className="text-white font-semibold">
                                #{p.player_number} {p.name}
                              </span>
                              <span className="block text-[10px] text-[#71717A]">
                                {p.phone} • {p.email}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#A0A0A0]">₹100</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Notes */}
                  <div className="lg:col-span-4 space-y-3 bg-[#111111] p-3 border border-[#252525]">
                    <div>
                      <label className="block text-[9px] font-mono uppercase text-[#A0A0A0] mb-1">
                        Admin Note (Included in Rejection Mail)
                      </label>
                      <textarea
                        rows={2}
                        value={notes[reg.registration_id] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [reg.registration_id]: e.target.value,
                          }))
                        }
                        placeholder="e.g. UTR verified or Blurry screenshot"
                        className="w-full bg-[#050505] border border-[#353535] p-2 text-xs font-mono text-white placeholder-[#555] focus:border-[#3300FF] outline-none"
                      />
                    </div>

                    {reg.reviewed_at && (
                      <div className="text-[9px] font-mono text-[#71717A]">
                        Reviewed: {reg.reviewed_at}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={inProgress}
                        onClick={() => handleAction(reg, 'APPROVE')}
                        className="py-2 px-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                      >
                        <Check size={13} />
                        <span>{inProgress === 'APPROVE' ? 'Approving...' : 'Approve'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={inProgress}
                        onClick={() => handleAction(reg, 'REJECT')}
                        className="py-2 px-2.5 bg-[#1d0d0d] hover:bg-red-900/60 border border-red-700/50 disabled:opacity-50 text-red-300 font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                      >
                        <X size={13} />
                        <span>{inProgress === 'REJECT' ? 'Rejecting...' : 'Reject'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Copyable Email Template Modal */}
      {emailModal.isOpen && (
        <div
          onClick={() => setEmailModal((prev) => ({ ...prev, isOpen: false }))}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#0e0e0e] border-2 border-[#3300FF] shadow-[0_0_50px_rgba(51,0,255,0.4)] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#141414] border-b border-[#252525] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-[#00D4FF]" />
                <span className="font-mono text-xs uppercase font-bold text-white">
                  Ready-to-Send Email ({emailModal.type === 'APPROVE' ? 'Approval Notice' : 'Rejection Notice'})
                </span>
              </div>
              <button
                onClick={() => setEmailModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 text-[#A0A0A0] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 font-mono text-xs">
              <div className="p-3 bg-[#141414] border border-[#252525] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#A0A0A0] text-[11px]">To:</span>
                  <span className="text-[#00D4FF] font-bold">{emailModal.recipient}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#222] pt-2">
                  <span className="text-[#A0A0A0] text-[11px]">Subject:</span>
                  <span className="text-white font-semibold text-right truncate max-w-md">
                    {emailModal.subject}
                  </span>
                </div>
              </div>

              {/* Editable/Copyable Textarea */}
              <div>
                <label className="block text-[10px] text-[#A0A0A0] uppercase mb-1 flex items-center justify-between">
                  <span>Email Message Body</span>
                  <span className="text-[#71717A]">You can edit before copying</span>
                </label>
                <textarea
                  rows={13}
                  value={emailModal.body}
                  onChange={(e) =>
                    setEmailModal((prev) => ({ ...prev, body: e.target.value }))
                  }
                  className="w-full bg-[#050505] border border-[#353535] p-3 text-xs font-mono text-[#e2e2e2] leading-relaxed focus:border-[#3300FF] outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#252525]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBody}
                    className="px-4 py-2 bg-[#3300FF] hover:bg-[#00D4FF] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                  >
                    {copiedBody ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedBody ? 'Copied Message!' : 'Copy Message Body'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyFull}
                    className="px-4 py-2 bg-[#1b1b1b] hover:bg-[#282828] border border-[#353535] text-[#A0A0A0] hover:text-white font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                  >
                    {copiedFull ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedFull ? 'Copied All!' : 'Copy Full (To + Subject + Body)'}</span>
                  </button>
                </div>

                <a
                  href={`mailto:${encodeURIComponent(emailModal.recipient)}?subject=${encodeURIComponent(
                    emailModal.subject
                  )}&body=${encodeURIComponent(emailModal.body)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                >
                  <Send size={14} />
                  <span>Open in Mail App</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-[#0c0c0c] border border-[#3300FF] p-2"
          >
            <div className="flex items-center justify-between p-3 border-b border-[#252525] bg-[#141414]">
              <span className="font-mono text-xs uppercase text-white font-bold">
                Payment Screenshot Inspection
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={lightboxImage}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-[#A0A0A0] hover:text-[#00D4FF] text-xs font-mono flex items-center gap-1"
                >
                  <ExternalLink size={14} />
                  <span>Open in tab</span>
                </a>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-1 text-[#A0A0A0] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 flex items-center justify-center max-h-[80vh] overflow-auto">
              <img
                src={lightboxImage}
                alt="Full resolution proof"
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
