import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Crosshair,
  Shield,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  UploadCloud,
  X,
  ExternalLink,
  Search,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Phone,
  Mail,
  User,
  ArrowRight,
  Zap,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { laserTagApi } from '../lib/laserTagApi';
import { DEFAULT_UPI_ID, generateUpiPayload } from '../lib/laserTagService';

const HOUR_TABS = [
  { id: 'ALL', label: 'All Slots', count: 36 },
  { id: '18', label: '6–7 PM', count: 6 },
  { id: '19', label: '7–8 PM', count: 6 },
  { id: '20', label: '8–9 PM', count: 6 },
  { id: '21', label: '9–10 PM', count: 6 },
  { id: '22', label: '10–11 PM', count: 6 },
  { id: '23', label: '11 PM–12 AM', count: 6 },
];

export default function LaserTag() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHour, setSelectedHour] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Selected slot & team for booking
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('Team A'); // 'Team A' | 'Team B'
  const [playerCount, setPlayerCount] = useState(4);

  // Player roster form state
  const [players, setPlayers] = useState([
    { name: '', email: '', phone: '' },
    { name: '', email: '', phone: '' },
    { name: '', email: '', phone: '' },
    { name: '', email: '', phone: '' },
  ]);
  const [utrReference, setUtrReference] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [completedBooking, setCompletedBooking] = useState(null);

  // UPI Copy feedback
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedRegId, setCopiedRegId] = useState(false);

  // Status Lookup Modal
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResults, setLookupResults] = useState(null);
  const [lookupError, setLookupError] = useState('');

  const bookingRef = useRef(null);

  const fetchSlots = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await laserTagApi.getSlots();
      setSlots(data || []);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSlots();
    const interval = setInterval(() => fetchSlots(), 15000); // 15s live polling
    return () => clearInterval(interval);
  }, []);

  // Update roster size dynamically based on playerCount
  const handlePlayerCountChange = (count) => {
    setPlayerCount(count);
    setPlayers((prev) => {
      const updated = [...prev];
      while (updated.length < count) {
        updated.push({ name: '', email: '', phone: '' });
      }
      return updated.slice(0, count);
    });
  };

  // Open booking drawer/form for a chosen slot and team
  const handleSelectSlotTeam = (slot, team) => {
    const side = team === 'Team A' ? slot.team_a : slot.team_b;
    if (side.spots_left <= 0) return;

    setSelectedSlot(slot);
    setSelectedTeam(team);
    const initialCount = Math.min(4, side.spots_left);
    handlePlayerCountChange(initialCount);
    setSubmitError('');

    // Smooth scroll to booking form
    setTimeout(() => {
      bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Handle screenshot selection
  const handleScreenshotChange = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Screenshot size must be under 5 MB');
      return;
    }
    setSubmitError('');
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setScreenshotPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // Handle Roster Input Changes
  const handlePlayerInputChange = (index, field, value) => {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Copy UPI ID
  const handleCopyUpi = () => {
    navigator.clipboard.writeText(DEFAULT_UPI_ID);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Submit Registration
  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    // Validate inputs
    for (let i = 0; i < playerCount; i++) {
      const p = players[i];
      if (!p.name?.trim() || !p.email?.trim() || !p.phone?.trim()) {
        setSubmitError(`Please fill all details for Player ${i + 1} (${i === 0 ? 'Squad Captain' : 'Teammate'})`);
        return;
      }
    }

    if (!screenshotFile) {
      setSubmitError('Payment screenshot upload is required to verify and hold your slot.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const created = await laserTagApi.registerSlot({
        slotId: selectedSlot.slot_id,
        team: selectedTeam,
        players: players.slice(0, playerCount),
        utrReference,
        screenshotFile,
      });

      setCompletedBooking(created);
      setSelectedSlot(null);
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setUtrReference('');
      fetchSlots(); // refresh slot availability immediately
    } catch (err) {
      console.error('Registration failed:', err);
      setSubmitError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Lookup Registration Status
  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;

    setLookupLoading(true);
    setLookupError('');
    setLookupResults(null);

    try {
      const results = await laserTagApi.lookupRegistration(lookupQuery);
      if (!results || results.length === 0) {
        setLookupError('No bookings found matching this ID, email, or phone number.');
      } else {
        setLookupResults(results);
      }
    } catch (err) {
      console.error('Lookup failed:', err);
      setLookupError('Failed to query booking. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Dynamic UPI URI for currently selected slot, team, and count
  const currentUpiPayload = selectedSlot
    ? generateUpiPayload({
        upiId: DEFAULT_UPI_ID,
        slotId: selectedSlot.slot_id,
        team: selectedTeam,
        playerCount,
      })
    : '';

  const filteredSlots = selectedHour === 'ALL'
    ? slots
    : slots.filter((s) => s.hour_block === selectedHour);

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-[#3300FF] selection:text-white pb-32">
      <Navbar />

      {/* Cyberpunk Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20 pixel-grid-bg z-0" />

      {/* Hero Header Section */}
      <section className="relative z-10 pt-32 pb-16 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="border border-[#353535] bg-[#0c0c0c]/80 backdrop-blur-xl p-8 md:p-12 relative overflow-hidden">
          {/* Neon laser decorative line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#3300FF] via-[#00D4FF] to-[#FF0066]" />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 bg-[#3300FF]/10 border border-[#3300FF]/40 text-[#00D4FF] text-xs font-mono uppercase tracking-widest">
                <Crosshair size={14} className="animate-spin" />
                <span>FLAME University • DotSlash Arena Event</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold uppercase tracking-tight text-white font-headline-display">
                LASER TAG <span className="text-[#3300FF]">4v4</span> ARENA
              </h1>
              <p className="mt-3 text-[#A0A0A0] max-w-2xl font-mono text-sm leading-relaxed">
                Continuous 10-minute skirmishes • Team A vs. Team B • ₹100 / Player.
                Book a solo spot or bring up to a 4-player squad. Slots are held provisionally until payment screenshot approval.
              </p>
            </div>

            {/* Quick Actions / Date Pill */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="px-4 py-3 bg-[#131313] border border-[#353535] text-center font-mono">
                <span className="block text-[10px] text-[#A0A0A0] uppercase tracking-wider">Event Date</span>
                <span className="text-[#00D4FF] font-bold text-sm">October 22, 2026</span>
                <span className="block text-[11px] text-[#A0A0A0]">6:00 PM – 12:00 AM</span>
              </div>

              <button
                onClick={() => {
                  setShowLookupModal(true);
                  setLookupResults(null);
                  setLookupError('');
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1b1b1b] hover:bg-[#3300FF] border border-[#353535] hover:border-[#3300FF] text-white text-xs font-mono uppercase tracking-wider transition-all duration-300"
              >
                <Search size={14} />
                <span>Check Booking Status</span>
              </button>
            </div>
          </div>

          {/* Quick Stat Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-[#252525]">
            <div>
              <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Combat Format</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-1.5 mt-0.5">
                <Shield size={14} className="text-[#3300FF]" /> 4 vs 4 Tactical
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Slot Length</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-1.5 mt-0.5">
                <Clock size={14} className="text-[#00D4FF]" /> 10 Minutes Continuous
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Entry Fee</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-1.5 mt-0.5">
                <Zap size={14} className="text-emerald-400" /> ₹100 / Person
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Verification</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-1.5 mt-0.5">
                <Sparkles size={14} className="text-amber-400" /> Instant Screenshot Hold
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Completed Booking Success Banner */}
      <AnimatePresence>
        {completedBooking && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 mb-12 relative z-20"
          >
            <div className="p-8 bg-[#0d1f14] border-2 border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.2)] relative">
              <button
                onClick={() => setCompletedBooking(null)}
                className="absolute top-4 right-4 text-emerald-400 hover:text-white"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-mono uppercase tracking-widest mb-3">
                    <CheckCircle2 size={16} />
                    <span>Booking Submitted • Spots Held Provisionally</span>
                  </div>
                  <h3 className="text-2xl font-bold uppercase tracking-tight text-white font-headline-md">
                    Registration Receipt: {completedBooking.registration_id}
                  </h3>
                  <p className="text-emerald-200/80 font-mono text-xs mt-1 max-w-2xl leading-relaxed">
                    Your {completedBooking.player_count} spot(s) for {completedBooking.team} ({completedBooking.slot_id}) are held awaiting admin screenshot verification. Once approved, your slot will transition to <strong className="text-white">CONFIRMED</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(completedBooking.registration_id);
                      setCopiedRegId(true);
                      setTimeout(() => setCopiedRegId(false), 2000);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    {copiedRegId ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedRegId ? 'Copied ID' : 'Copy Registration ID'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setLookupQuery(completedBooking.registration_id);
                      setShowLookupModal(true);
                      handleLookup({ preventDefault: () => {} });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#030303] border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 font-mono text-xs uppercase tracking-wider transition-colors"
                  >
                    <Search size={14} />
                    <span>View Live Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Hour Tabs & Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8">
          {/* Scrollable Hour Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {HOUR_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedHour(tab.id)}
                className={`px-4 py-2.5 font-mono text-xs uppercase tracking-wider whitespace-nowrap border transition-all duration-200 flex items-center gap-2 ${
                  selectedHour === tab.id
                    ? 'bg-[#3300FF] border-[#3300FF] text-white font-bold shadow-[0_0_15px_rgba(51,0,255,0.4)]'
                    : 'bg-[#131313] border-[#353535] text-[#A0A0A0] hover:text-white hover:border-[#52525B]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded ${
                    selectedHour === tab.id ? 'bg-white/20 text-white' : 'bg-[#252525] text-[#71717A]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Refresh / Live Indicator */}
          <div className="flex items-center justify-end gap-3 font-mono text-xs text-[#A0A0A0]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Slot Sync</span>
            </span>
            <button
              onClick={() => fetchSlots(true)}
              disabled={refreshing}
              className="p-2 bg-[#131313] border border-[#353535] hover:border-[#3300FF] text-[#A0A0A0] hover:text-white transition-colors"
              title="Refresh availability"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#00D4FF]' : ''} />
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-[#131313] border border-[#252525] animate-pulse" />
            ))}
          </div>
        ) : (
          /* 36-Slot Interactive Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSlots.map((slot) => {
              const isSlotSelected = selectedSlot?.slot_id === slot.slot_id;

              return (
                <div
                  key={slot.slot_id}
                  className={`bg-[#0d0d0d] border transition-all duration-300 flex flex-col justify-between ${
                    isSlotSelected
                      ? 'border-[#00D4FF] shadow-[0_0_20px_rgba(0,212,255,0.25)]'
                      : 'border-[#252525] hover:border-[#3300FF]/60'
                  }`}
                >
                  {/* Slot Header */}
                  <div className="p-5 border-b border-[#202020] bg-[#111111] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#A0A0A0] block">
                        Slot #{slot.start_time}
                      </span>
                      <h4 className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-2">
                        <Clock size={16} className="text-[#3300FF]" />
                        <span>{slot.time_window}</span>
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-[#1b1b1b] border border-[#353535] text-[#A0A0A0]">
                      10 MIN
                    </span>
                  </div>

                  {/* Team Sides Area */}
                  <div className="p-5 space-y-4">
                    {/* Team A Card */}
                    <TeamSideSelector
                      team={slot.team_a}
                      teamName="Team A"
                      isSelected={isSlotSelected && selectedTeam === 'Team A'}
                      onSelect={() => handleSelectSlotTeam(slot, 'Team A')}
                    />

                    {/* Team B Card */}
                    <TeamSideSelector
                      team={slot.team_b}
                      teamName="Team B"
                      isSelected={isSlotSelected && selectedTeam === 'Team B'}
                      onSelect={() => handleSelectSlotTeam(slot, 'Team B')}
                    />
                  </div>

                  {/* Slot Footer indicator */}
                  <div className="px-5 py-2.5 bg-[#080808] border-t border-[#1a1a1a] flex items-center justify-between text-[11px] font-mono text-[#71717A]">
                    <span>Total Arena: 8 spots</span>
                    <span>
                      {(slot.team_a.spots_left + slot.team_b.spots_left)} / 8 Open
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Booking Form Section */}
        <AnimatePresence>
          {selectedSlot && (
            <motion.section
              ref={bookingRef}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-16 border-2 border-[#3300FF] bg-[#0c0c0c] shadow-[0_0_40px_rgba(51,0,255,0.25)] relative overflow-hidden"
            >
              {/* Header Bar */}
              <div className="bg-[#131313] px-6 py-5 border-b border-[#252525] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#00D4FF] uppercase tracking-wider">
                    <Crosshair size={14} />
                    <span>Booking Step: Squad Roster & UPI Settlement</span>
                  </div>
                  <h2 className="text-2xl font-bold uppercase tracking-tight text-white font-headline-md mt-1">
                    {selectedSlot.time_window} • <span className="text-[#3300FF]">{selectedTeam}</span>
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedSlot(null)}
                  className="self-start sm:self-center p-2 text-[#A0A0A0] hover:text-white border border-[#353535] hover:border-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitRegistration} className="p-6 md:p-8 space-y-8">
                {/* 1. Squad Size Selector */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-3">
                    1. Select Squad Size ({selectedTeam}) — Capped by remaining capacity
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((count) => {
                      const side = selectedTeam === 'Team A' ? selectedSlot.team_a : selectedSlot.team_b;
                      const isAvailable = count <= side.spots_left;

                      return (
                        <button
                          key={count}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => handlePlayerCountChange(count)}
                          className={`p-4 border font-mono text-left transition-all ${
                            !isAvailable
                              ? 'opacity-30 border-[#202020] bg-[#080808] cursor-not-allowed text-[#555]'
                              : playerCount === count
                              ? 'border-[#00D4FF] bg-[#3300FF]/20 text-white shadow-[0_0_15px_rgba(0,212,255,0.3)]'
                              : 'border-[#353535] bg-[#131313] text-[#A0A0A0] hover:border-[#52525B] hover:text-white'
                          }`}
                        >
                          <span className="block text-lg font-bold">
                            {count} {count === 1 ? 'Player' : 'Players'}
                          </span>
                          <span className="text-xs text-[#00D4FF] font-semibold">
                            ₹{count * 100} Total
                          </span>
                          {!isAvailable && (
                            <span className="block text-[10px] text-red-400 mt-1">
                              Only {side.spots_left} spot(s) left
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Squad Roster Inputs */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-3">
                    2. Squad Roster Details ({playerCount} {playerCount === 1 ? 'Player' : 'Players'})
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {players.map((p, idx) => (
                      <div
                        key={idx}
                        className={`p-4 border ${
                          idx === 0
                            ? 'border-[#3300FF]/60 bg-[#11111d]'
                            : 'border-[#252525] bg-[#101010]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-xs font-bold uppercase text-white flex items-center gap-1.5">
                            <User size={13} className={idx === 0 ? 'text-[#00D4FF]' : 'text-[#A0A0A0]'} />
                            <span>Player {idx + 1} {idx === 0 ? '• Squad Captain' : ''}</span>
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#3300FF]/30 text-[#00D4FF] border border-[#3300FF]/40">
                              Primary Contact
                            </span>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <input
                              type="text"
                              required
                              value={p.name}
                              onChange={(e) => handlePlayerInputChange(idx, 'name', e.target.value)}
                              placeholder="Full Name"
                              className="w-full bg-[#050505] border border-[#353535] px-3.5 py-2.5 text-xs font-mono text-white placeholder-[#555] focus:border-[#3300FF] outline-none"
                            />
                          </div>
                          <div>
                            <input
                              type="email"
                              required
                              value={p.email}
                              onChange={(e) => handlePlayerInputChange(idx, 'email', e.target.value)}
                              placeholder="Email Address"
                              className="w-full bg-[#050505] border border-[#353535] px-3.5 py-2.5 text-xs font-mono text-white placeholder-[#555] focus:border-[#3300FF] outline-none"
                            />
                          </div>
                          <div>
                            <input
                              type="tel"
                              required
                              value={p.phone}
                              onChange={(e) => handlePlayerInputChange(idx, 'phone', e.target.value)}
                              placeholder="Phone / WhatsApp Number"
                              className="w-full bg-[#050505] border border-[#353535] px-3.5 py-2.5 text-xs font-mono text-white placeholder-[#555] focus:border-[#3300FF] outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Custom Dynamic UPI QR & Payment Screenshot Upload */}
                <div className="p-6 border border-[#252525] bg-[#0f0f0f]">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-4 flex items-center gap-2">
                    <span>3. NPCI Dynamic UPI Settlement & Verification Screenshot</span>
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Dynamic QR Code Card */}
                    <div className="lg:col-span-5 bg-[#141414] border border-[#353535] p-6 text-center flex flex-col items-center">
                      <div className="text-[11px] font-mono uppercase text-[#A0A0A0] mb-1">
                        Exact Payable Amount
                      </div>
                      <div className="text-3xl font-extrabold font-mono text-white mb-4">
                        ₹{playerCount * 100}
                        <span className="text-xs text-[#00D4FF] font-normal ml-1">
                          ({playerCount} × ₹100)
                        </span>
                      </div>

                      {/* High-contrast QR Scan Box */}
                      <div className="p-3 bg-white border-4 border-[#3300FF] rounded-sm mb-4 inline-block shadow-[0_0_20px_rgba(51,0,255,0.4)]">
                        <QRCodeSVG
                          value={currentUpiPayload}
                          size={180}
                          level="M"
                          includeMargin={false}
                        />
                      </div>

                      {/* Receiving UPI ID with Copy Button */}
                      <div className="w-full bg-[#080808] border border-[#303030] p-2.5 mb-3 flex items-center justify-between font-mono text-xs">
                        <span className="text-[#A0A0A0] truncate pr-2">{DEFAULT_UPI_ID}</span>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#3300FF] hover:bg-[#00D4FF] text-white font-bold transition-colors text-[10px] uppercase"
                        >
                          {copiedUpi ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      {/* Pay Now Deep Link Button for Mobile Users */}
                      <a
                        href={currentUpiPayload}
                        className="w-full py-3 px-4 bg-[#3300FF] hover:bg-[#00D4FF] text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors duration-300"
                      >
                        <ExternalLink size={14} />
                        <span>Pay Now via UPI App (Mobile)</span>
                      </a>
                      <span className="block text-[10px] font-mono text-[#71717A] mt-2">
                        Supported: Google Pay, PhonePe, Paytm, CRED, BHIM
                      </span>
                    </div>

                    {/* Right: Payment Screenshot Upload (Mandatory) + UTR Input */}
                    <div className="lg:col-span-7 space-y-4">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-white mb-1.5 flex items-center gap-2">
                          <span>Upload Payment Screenshot (Mandatory)</span>
                          <span className="text-[10px] text-red-400 font-normal">*Required</span>
                        </label>
                        <p className="text-[11px] font-mono text-[#A0A0A0] mb-3">
                          Attach the success screen showing transaction amount (₹{playerCount * 100}) and reference number. Form cannot be submitted without this.
                        </p>

                        {/* File Upload Drop Area */}
                        {!screenshotPreview ? (
                          <label className="border-2 border-dashed border-[#353535] hover:border-[#3300FF] bg-[#0a0a0a] p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group">
                            <UploadCloud
                              size={36}
                              className="text-[#71717A] group-hover:text-[#00D4FF] transition-colors mb-3"
                            />
                            <span className="font-mono text-xs text-white font-bold uppercase">
                              Click or Drag & Drop Payment Screenshot
                            </span>
                            <span className="font-mono text-[10px] text-[#A0A0A0] mt-1">
                              Supports PNG, JPG, JPEG, WEBP (Max 5 MB)
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => handleScreenshotChange(e.target.files?.[0])}
                            />
                          </label>
                        ) : (
                          /* Image Preview Box */
                          <div className="relative border border-[#353535] bg-[#050505] p-3 flex items-center gap-4">
                            <img
                              src={screenshotPreview}
                              alt="Payment Proof Preview"
                              className="w-24 h-24 object-cover border border-[#252525]"
                            />
                            <div className="flex-1 min-w-0 font-mono text-xs">
                              <span className="text-emerald-400 font-bold block mb-1 flex items-center gap-1">
                                <CheckCircle2 size={14} /> File Attached
                              </span>
                              <span className="text-[#A0A0A0] block truncate">
                                {screenshotFile?.name}
                              </span>
                              <span className="text-[10px] text-[#71717A] block">
                                {((screenshotFile?.size || 0) / 1024).toFixed(1)} KB
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setScreenshotFile(null);
                                setScreenshotPreview(null);
                              }}
                              className="p-2 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400 transition-colors"
                              title="Remove file"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Optional UTR / Reference ID */}
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-1.5">
                          UTR / UPI Transaction ID (Optional but recommended)
                        </label>
                        <input
                          type="text"
                          value={utrReference}
                          onChange={(e) => setUtrReference(e.target.value)}
                          placeholder="e.g. 4287XXXXXXXX or 12-digit UPI Ref"
                          className="w-full bg-[#050505] border border-[#353535] px-4 py-3 text-xs font-mono text-white placeholder-[#555] focus:border-[#3300FF] outline-none"
                        />
                      </div>

                      {/* Error Banner */}
                      {submitError && (
                        <div className="p-3 bg-red-950/50 border border-red-600/50 text-red-300 font-mono text-xs flex items-center gap-2">
                          <AlertCircle size={16} className="shrink-0" />
                          <span>{submitError}</span>
                        </div>
                      )}

                      {/* Submit CTA */}
                      <button
                        type="submit"
                        disabled={submitting || !screenshotFile}
                        className={`w-full py-4 px-6 font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 ${
                          submitting || !screenshotFile
                            ? 'bg-[#202020] text-[#666] border border-[#333] cursor-not-allowed'
                            : 'bg-[#3300FF] hover:bg-[#00D4FF] text-white shadow-[0_0_20px_rgba(51,0,255,0.4)]'
                        }`}
                      >
                        {submitting ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Submitting & Holding Spots...</span>
                          </>
                        ) : (
                          <>
                            <Crosshair size={16} />
                            <span>
                              Submit Registration & Hold {playerCount} Spot(s) (₹{playerCount * 100})
                            </span>
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Booking Status Lookup Modal */}
      <AnimatePresence>
        {showLookupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#0e0e0e] border border-[#353535] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-[#141414] border-b border-[#252525] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-[#00D4FF]" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                    Check Laser Tag Booking Status
                  </span>
                </div>
                <button
                  onClick={() => setShowLookupModal(false)}
                  className="p-1 text-[#A0A0A0] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                <form onSubmit={handleLookup} className="flex gap-2">
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="Enter Registration ID, Captain Email, or Phone"
                    className="flex-1 bg-[#050505] border border-[#353535] px-4 py-3 font-mono text-xs text-white placeholder-[#555] focus:border-[#3300FF] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading || !lookupQuery.trim()}
                    className="px-6 py-3 bg-[#3300FF] hover:bg-[#00D4FF] disabled:bg-[#202020] text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    {lookupLoading ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {lookupError && (
                  <p className="font-mono text-xs text-red-400 bg-red-950/40 p-3 border border-red-800/40">
                    {lookupError}
                  </p>
                )}

                {/* Results List */}
                {lookupResults && lookupResults.length > 0 && (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {lookupResults.map((booking) => (
                      <div
                        key={booking.registration_id}
                        className="p-5 border border-[#252525] bg-[#121212] space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#202020] pb-3">
                          <div>
                            <span className="text-[10px] font-mono text-[#A0A0A0] uppercase block">
                              Registration ID
                            </span>
                            <span className="font-mono font-bold text-sm text-[#00D4FF]">
                              {booking.registration_id}
                            </span>
                          </div>
                          <BookingStatusBadge status={booking.booking_status} paymentStatus={booking.payment_status} />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                          <div>
                            <span className="text-[10px] text-[#71717A] uppercase block">Time Window</span>
                            <span className="text-white font-semibold">{booking.time_window}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#71717A] uppercase block">Team Side</span>
                            <span className="text-white font-semibold">{booking.team}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#71717A] uppercase block">Players</span>
                            <span className="text-white font-semibold">{booking.player_count}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#71717A] uppercase block">Amount Paid</span>
                            <span className="text-emerald-400 font-semibold">₹{booking.total_fee}</span>
                          </div>
                        </div>

                        {/* Captain Details */}
                        <div className="pt-2 text-xs font-mono text-[#A0A0A0] border-t border-[#1e1e1e] flex flex-wrap gap-x-6 gap-y-1">
                          <span>Captain: <strong className="text-white">{booking.captain_name}</strong></span>
                          <span>Email: <strong className="text-white">{booking.captain_email}</strong></span>
                          <span>Phone: <strong className="text-white">{booking.captain_phone}</strong></span>
                        </div>

                        {/* Admin Note if any */}
                        {booking.admin_note && (
                          <div className="p-2.5 bg-[#1b1b1b] border-l-2 border-[#3300FF] font-mono text-xs text-[#c4c7c8]">
                            <span className="text-[10px] text-[#A0A0A0] uppercase block">Admin Verification Note:</span>
                            {booking.admin_note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}

// Subcomponent: Live Team Side Selector Card inside a Slot
function TeamSideSelector({ team, teamName, isSelected, onSelect }) {
  const isAvailable = team.status === 'AVAILABLE';
  const isOpen = team.status === 'OPEN';
  const isPending = team.status === 'PENDING_APPROVAL';
  const isFull = team.status === 'FULL';

  return (
    <div
      className={`p-3.5 border transition-all ${
        isSelected
          ? 'border-[#00D4FF] bg-[#3300FF]/15'
          : 'border-[#232323] bg-[#090909] hover:border-[#383838]'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-bold uppercase text-white flex items-center gap-1.5">
          <Shield
            size={13}
            className={teamName === 'Team A' ? 'text-[#3300FF]' : 'text-[#FF0066]'}
          />
          <span>{teamName}</span>
        </span>
        <span className="font-mono text-[11px] text-[#A0A0A0]">
          {team.spots_left}/4 Open
        </span>
      </div>

      {/* Status Badge */}
      <div className="mb-3">
        {isAvailable && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] uppercase font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            AVAILABLE (4/4 open)
          </span>
        )}
        {isOpen && (
          <div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-[#00D4FF] font-mono text-[10px] uppercase font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D4FF]" />
              OPEN ({team.spots_left}/4 left)
            </span>
            {team.pending_players > 0 && (
              <span className="block text-[9px] font-mono text-amber-400/90 mt-0.5">
                • {team.pending_players} held awaiting verification
              </span>
            )}
          </div>
        )}
        {isPending && (
          <div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] uppercase font-semibold">
              <Clock size={10} />
              PENDING APPROVAL
            </span>
            <span className="block text-[9px] font-mono text-[#A0A0A0] mt-0.5">
              Held provisionally awaiting screenshot
            </span>
          </div>
        )}
        {isFull && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 font-mono text-[10px] uppercase font-semibold">
            FINALIZED / FULL (0/4)
          </span>
        )}
      </div>

      {/* Select Button */}
      <button
        type="button"
        disabled={team.spots_left <= 0}
        onClick={onSelect}
        className={`w-full py-2 px-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
          team.spots_left <= 0
            ? 'bg-[#151515] text-[#555] cursor-not-allowed border border-[#222]'
            : isSelected
            ? 'bg-[#00D4FF] text-black font-extrabold'
            : 'bg-[#1a1a1a] hover:bg-[#3300FF] text-white border border-[#303030] hover:border-[#3300FF]'
        }`}
      >
        <span>{team.spots_left <= 0 ? 'Full / Held' : isSelected ? 'Selected' : 'Book Side'}</span>
        {team.spots_left > 0 && !isSelected && <ChevronRight size={12} />}
      </button>
    </div>
  );
}

// Subcomponent: Booking Status Badge for Receipts
function BookingStatusBadge({ status, paymentStatus }) {
  if (status === 'CONFIRMED' || paymentStatus === 'APPROVED') {
    return (
      <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-xs uppercase font-bold flex items-center gap-1.5">
        <CheckCircle2 size={13} />
        <span>CONFIRMED</span>
      </span>
    );
  }
  if (status === 'REJECTED' || paymentStatus === 'REJECTED') {
    return (
      <span className="px-3 py-1 bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-xs uppercase font-bold flex items-center gap-1.5">
        <AlertCircle size={13} />
        <span>REJECTED</span>
      </span>
    );
  }
  return (
    <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono text-xs uppercase font-bold flex items-center gap-1.5 animate-pulse">
      <Clock size={13} />
      <span>PENDING SCREENSHOT APPROVAL</span>
    </span>
  );
}
