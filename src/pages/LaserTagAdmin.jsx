import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  Users,
  DollarSign,
  Maximize2,
  X,
  LogOut,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  FileText,
  Check,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { laserTagApi } from '../lib/laserTagApi';

export default function LaserTagAdmin() {
  const navigate = useNavigate();

  // Check auth
  const role = localStorage.getItem('dotslash_admin_auth');
  if (!role) {
    return <Navigate to="/login" replace />;
  }

  const [registrations, setRegistrations] = useState([]);
  const [kpis, setKpis] = useState({
    totalSlots: 36,
    confirmedPlayers: 0,
    pendingPlayers: 0,
    approvedRevenue: 0,
    pendingRevenue: 0,
  });

  const [filter, setFilter] = useState('PENDING_VERIFICATION'); // 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lightbox state for inspecting payment screenshots
  const [lightboxImage, setLightboxImage] = useState(null);

  // Admin note inputs per registration
  const [notes, setNotes] = useState({});
  const [actionInProgress, setActionInProgress] = useState({}); // { [regId]: 'APPROVE' | 'REJECT' }
  const [actionMessage, setActionMessage] = useState({ text: '', type: '' });

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await laserTagApi.getAdminRegistrations(filter);
      setRegistrations(data.registrations || []);
      if (data.kpis) setKpis(data.kpis);

      // Populate existing notes
      const initialNotes = {};
      (data.registrations || []).forEach((r) => {
        initialNotes[r.registration_id] = r.admin_note || '';
      });
      setNotes((prev) => ({ ...initialNotes, ...prev }));
    } catch (err) {
      console.error('Failed to load admin laser tag data:', err);
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

  const handleLogout = () => {
    localStorage.removeItem('dotslash_admin_auth');
    navigate('/login');
  };

  const handleAction = async (registrationId, action) => {
    const note = notes[registrationId] || '';
    setActionInProgress((prev) => ({ ...prev, [registrationId]: action }));
    setActionMessage({ text: '', type: '' });

    try {
      await laserTagApi.updateAdminRegistration(registrationId, {
        action,
        adminNote: note,
      });

      setActionMessage({
        text: `Registration ${registrationId} has been ${action === 'APPROVE' ? 'APPROVED (Slot Locked)' : 'REJECTED (Held spots freed)'}.`,
        type: action === 'APPROVE' ? 'success' : 'warning',
      });

      // Reload list and KPIs
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
        delete next[registrationId];
        return next;
      });
    }
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
    <div className="min-h-screen bg-[#030303] text-white selection:bg-[#3300FF] selection:text-white pb-32">
      {/* Top Header */}
      <header className="border-b border-[#252525] bg-[#0c0c0c]/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="p-2 bg-[#141414] border border-[#353535] hover:border-[#3300FF] text-[#A0A0A0] hover:text-white transition-colors"
              title="Return to Main Admin Dashboard"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-xs tracking-widest uppercase font-semibold text-[#00D4FF]">
                  DotSlash System Portal
                </span>
                <span className="px-1.5 py-0.2 bg-[#3300FF]/30 border border-[#3300FF] text-[10px] font-mono text-[#00D4FF]">
                  LASER TAG ADMIN
                </span>
              </div>
              <h1 className="text-xl font-bold font-headline-md tracking-tight uppercase text-white">
                Screenshot Verification Queue
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/laser-tag"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-[#151515] hover:bg-[#202020] border border-[#353535] text-xs font-mono text-[#A0A0A0] hover:text-white transition-colors"
            >
              <ExternalLink size={13} />
              <span>Public Page</span>
            </Link>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 bg-[#151515] border border-[#353535] hover:border-white text-[#A0A0A0] hover:text-white transition-colors"
              title="Refresh queue"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-[#00D4FF]' : ''} />
            </button>

            <button
              onClick={handleLogout}
              className="p-2 bg-red-950/30 border border-red-800/40 hover:bg-red-900/40 text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* KPI Counter Cards */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-[#0e0e0e] border border-[#252525]">
            <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Total Event Slots</span>
            <span className="text-2xl font-bold font-mono text-white mt-1 block">
              {kpis.totalSlots}
              <span className="text-xs font-normal text-[#71717A] ml-1.5">(288 spots)</span>
            </span>
          </div>

          <div className="p-4 bg-[#0e0e0e] border border-emerald-900/40">
            <span className="text-[10px] font-mono uppercase text-emerald-400 block">Confirmed Players</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
              {kpis.confirmedPlayers}
              <span className="text-xs font-normal text-emerald-600 ml-1.5">approved</span>
            </span>
          </div>

          <div className="p-4 bg-[#0e0e0e] border border-amber-900/40">
            <span className="text-[10px] font-mono uppercase text-amber-400 block">Pending Verification</span>
            <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
              {kpis.pendingPlayers}
              <span className="text-xs font-normal text-amber-600 ml-1.5">held</span>
            </span>
          </div>

          <div className="p-4 bg-[#0e0e0e] border border-[#3300FF]/40">
            <span className="text-[10px] font-mono uppercase text-[#00D4FF] block">Approved Revenue</span>
            <span className="text-2xl font-bold font-mono text-[#00D4FF] mt-1 block">
              ₹{kpis.approvedRevenue}
            </span>
          </div>

          <div className="p-4 bg-[#0e0e0e] border border-[#353535] col-span-2 md:col-span-1">
            <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Pending Revenue</span>
            <span className="text-2xl font-bold font-mono text-white mt-1 block">
              ₹{kpis.pendingRevenue}
            </span>
          </div>
        </section>

        {/* Global Action Message */}
        {actionMessage.text && (
          <div
            className={`p-4 font-mono text-xs border flex items-center justify-between ${
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

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#0d0d0d] p-4 border border-[#252525]">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {[
              { id: 'PENDING_VERIFICATION', label: 'Pending Review', color: 'text-amber-400' },
              { id: 'APPROVED', label: 'Approved', color: 'text-emerald-400' },
              { id: 'REJECTED', label: 'Rejected', color: 'text-red-400' },
              { id: 'ALL', label: 'All Registrations', color: 'text-white' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`px-3.5 py-2 font-mono text-xs uppercase tracking-wider transition-colors whitespace-nowrap border ${
                  filter === t.id
                    ? 'bg-[#1b1b1b] border-[#3300FF] text-white font-bold'
                    : 'border-transparent text-[#71717A] hover:text-white'
                }`}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-3 text-[#71717A]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ID, Captain, UTR..."
              className="w-full bg-[#050505] border border-[#303030] pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-[#555] focus:border-[#3300FF] outline-none"
            />
          </div>
        </div>

        {/* Registrations List */}
        {loading ? (
          <div className="p-12 text-center font-mono text-xs text-[#A0A0A0] bg-[#0c0c0c] border border-[#202020]">
            <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-[#3300FF]" />
            <span>Loading laser tag registrations...</span>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="p-16 text-center font-mono text-xs text-[#71717A] bg-[#0c0c0c] border border-[#202020]">
            <Shield size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm text-white font-semibold mb-1">No Registrations in this View</p>
            <p>
              {filter === 'PENDING_VERIFICATION'
                ? 'No registrations are currently awaiting payment screenshot review.'
                : 'No registration records match the current filter or search criteria.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
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
                      ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                      : isApproved
                      ? 'border-emerald-500/40'
                      : 'border-[#252525] opacity-75'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-[#202020] bg-[#121212] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono font-bold text-sm text-[#00D4FF]">
                        {reg.registration_id}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 font-mono text-[10px] uppercase font-bold border ${
                          reg.team === 'Team A'
                            ? 'bg-[#3300FF]/20 border-[#3300FF]/50 text-[#9966FF]'
                            : 'bg-[#FF0066]/20 border-[#FF0066]/50 text-[#FF0066]'
                        }`}
                      >
                        {reg.team}
                      </span>

                      <span className="px-2.5 py-0.5 bg-[#1f1f1f] border border-[#353535] text-[11px] font-mono text-white flex items-center gap-1.5">
                        <Clock size={12} className="text-[#3300FF]" />
                        <span>{reg.time_window}</span>
                      </span>

                      <span className="text-[11px] font-mono text-[#71717A]">
                        {reg.created_at}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPending && (
                        <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs uppercase font-bold flex items-center gap-1.5">
                          <Clock size={13} className="animate-spin" />
                          <span>PENDING SCREENSHOT VERIFICATION</span>
                        </span>
                      )}
                      {isApproved && (
                        <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono text-xs uppercase font-bold flex items-center gap-1.5">
                          <CheckCircle2 size={13} />
                          <span>APPROVED & LOCKED</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-300 font-mono text-xs uppercase font-bold flex items-center gap-1.5">
                          <XCircle size={13} />
                          <span>REJECTED (SPOTS FREED)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content Grid */}
                  <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Screenshot Inspector */}
                    <div className="lg:col-span-4 bg-[#141414] border border-[#2a2a2a] p-4 text-center">
                      <span className="block text-[10px] font-mono uppercase text-[#A0A0A0] mb-2 text-left flex items-center justify-between">
                        <span>Payment Screenshot</span>
                        <span className="text-[#71717A]">Click to inspect</span>
                      </span>

                      {reg.screenshot_url ? (
                        <div
                          onClick={() => setLightboxImage(reg.screenshot_url)}
                          className="relative group cursor-pointer border border-[#333] overflow-hidden bg-black max-h-56 flex items-center justify-center"
                        >
                          <img
                            src={reg.screenshot_url}
                            alt="Payment screenshot"
                            className="w-full h-auto max-h-56 object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-mono text-xs gap-1.5">
                            <Maximize2 size={16} />
                            <span>Inspect Fullscreen</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-40 bg-[#080808] flex items-center justify-center font-mono text-xs text-red-400">
                          No screenshot attached
                        </div>
                      )}

                      <div className="mt-3 text-left font-mono text-xs">
                        <span className="text-[10px] text-[#71717A] uppercase block">UTR / Ref:</span>
                        <span className="font-semibold text-white break-all">
                          {reg.utr_reference || 'Not provided by user'}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Squad Roster & Contact */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Captain Contact */}
                      <div className="p-3.5 bg-[#111111] border border-[#222]">
                        <span className="text-[10px] font-mono uppercase text-[#00D4FF] block mb-1">
                          Squad Captain
                        </span>
                        <div className="font-mono text-xs space-y-1">
                          <p className="text-white font-bold">{reg.captain_name}</p>
                          <p className="text-[#A0A0A0]">{reg.captain_email}</p>
                          <p className="text-[#A0A0A0]">{reg.captain_phone}</p>
                        </div>
                      </div>

                      {/* Roster Table */}
                      <div className="border border-[#222] bg-[#0c0c0c]">
                        <div className="px-3.5 py-2 bg-[#171717] border-b border-[#222] flex items-center justify-between text-[10px] font-mono uppercase text-[#A0A0A0]">
                          <span>Roster Breakdown ({reg.player_count} Players)</span>
                          <span className="text-emerald-400 font-bold">₹{reg.total_fee} Total</span>
                        </div>
                        <div className="divide-y divide-[#1c1c1c] font-mono text-xs">
                          {reg.players?.map((p) => (
                            <div key={p.player_number} className="p-2.5 flex items-center justify-between">
                              <div>
                                <span className="text-white font-semibold">
                                  #{p.player_number} {p.name}
                                </span>
                                <span className="block text-[10px] text-[#71717A]">
                                  {p.email} • {p.phone}
                                </span>
                              </div>
                              <span className="text-[10px] text-[#A0A0A0]">₹100</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Verification Action Controls */}
                    <div className="lg:col-span-3 space-y-4 bg-[#111111] p-4 border border-[#252525]">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-[#A0A0A0] mb-1.5">
                          Admin Verification Note
                        </label>
                        <textarea
                          rows={3}
                          value={notes[reg.registration_id] || ''}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [reg.registration_id]: e.target.value,
                            }))
                          }
                          placeholder="e.g. UTR verified on bank app, or screenshot illegible"
                          className="w-full bg-[#050505] border border-[#353535] p-2.5 text-xs font-mono text-white placeholder-[#555] focus:border-[#3300FF] outline-none"
                        />
                      </div>

                      {reg.reviewed_at && (
                        <div className="text-[10px] font-mono text-[#71717A]">
                          Reviewed: {reg.reviewed_at}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="space-y-2 pt-2">
                        <button
                          type="button"
                          disabled={inProgress}
                          onClick={() => handleAction(reg.registration_id, 'APPROVE')}
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Check size={14} />
                          <span>
                            {inProgress === 'APPROVE'
                              ? 'Approving...'
                              : 'Approve & Finalize Slot'}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={inProgress}
                          onClick={() => handleAction(reg.registration_id, 'REJECT')}
                          className="w-full py-2.5 px-3 bg-[#1d0d0d] hover:bg-red-900/60 border border-red-700/50 disabled:opacity-50 text-red-300 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <X size={14} />
                          <span>
                            {inProgress === 'REJECT'
                              ? 'Rejecting...'
                              : 'Reject & Free Spots'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lightbox Modal for Fullscreen Screenshot Inspection */}
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
                Payment Verification Screenshot
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
