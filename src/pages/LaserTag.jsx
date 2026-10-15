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
  HelpCircle,
  QrCode,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { laserTagApi } from '../lib/laserTagApi';
import {
  DEFAULT_UPI_ID,
  generateUpiPayload,
  getUpiConfigForSlot,
  SLOT_SCHEDULE,
  UPI_ACCOUNTS,
} from '../lib/laserTagService';

const HOUR_TABS = [
  { id: 'ALL', label: 'All Slots', count: 15 },
  { id: '20', label: '8–9 PM', count: 3 },
  { id: '21', label: '9–10 PM', count: 3 },
  { id: '22', label: '10–11 PM', count: 3 },
  { id: '23', label: '11 PM–12 AM', count: 3 },
  { id: '00', label: '12–1 AM', count: 3 },
];

export default function LaserTag() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHour, setSelectedHour] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Top registration mode: 'GROUP' | 'SOLO'
  const [registrationMode, setRegistrationMode] = useState('GROUP');

  // GROUP BOOKING STATE
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('Team A'); // 'Team A' | 'Team B'
  const [playerCount, setPlayerCount] = useState(4); // strictly 3 or 4

  const [players, setPlayers] = useState([
    { name: '', email: '', phone: '' },
    { name: '', email: '', phone: '' },
    { name: '', email: '', phone: '' },
    { name: '', email: '', phone: '' },
  ]);
  const [utrReference, setUtrReference] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [showOfficialQrImage, setShowOfficialQrImage] = useState(false);

  // SOLO REGISTRATION STATE
  const [soloName, setSoloName] = useState('');
  const [soloEmail, setSoloEmail] = useState('');
  const [soloPhone, setSoloPhone] = useState('');
  const [soloPreferredSlot, setSoloPreferredSlot] = useState('2026-10-22|SOLO_POOL');
  const [soloUtrReference, setSoloUtrReference] = useState('');
  const [soloScreenshotFile, setSoloScreenshotFile] = useState(null);
  const [soloScreenshotPreview, setSoloScreenshotPreview] = useState(null);
  const [soloSubmitting, setSoloSubmitting] = useState(false);
  const [soloSubmitError, setSoloSubmitError] = useState('');
  const [soloCopiedUpi, setSoloCopiedUpi] = useState(false);

  // Completed receipt
  const [completedBooking, setCompletedBooking] = useState(null);
  const [copiedRegId, setCopiedRegId] = useState(false);

  // Status Lookup Modal
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResults, setLookupResults] = useState(null);
  const [lookupError, setLookupError] = useState('');

  const bookingRef = useRef(null);
  const soloFormRef = useRef(null);

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

  // Update group squad size: strictly 3 or 4
  const handlePlayerCountChange = (count) => {
    const validCount = count === 3 ? 3 : 4;
    setPlayerCount(validCount);
    setPlayers((prev) => {
      const updated = [...prev];
      while (updated.length < validCount) {
        updated.push({ name: '', email: '', phone: '' });
      }
      return updated.slice(0, validCount);
    });
  };

  // Open group booking drawer for a chosen slot and team
  const handleSelectSlotTeam = (slot, team) => {
    const side = team === 'Team A' ? slot.team_a : slot.team_b;
    if (side.spots_left < 3) return;

    setSelectedSlot(slot);
    setSelectedTeam(team);
    // If only 3 spots left, set 3; otherwise default to 4
    const count = side.spots_left === 3 ? 3 : 4;
    handlePlayerCountChange(count);
    setSubmitError('');
    setShowOfficialQrImage(false);

    setTimeout(() => {
      bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Handle group screenshot selection
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

  // Handle solo screenshot selection
  const handleSoloScreenshotChange = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setSoloSubmitError('Screenshot size must be under 5 MB');
      return;
    }
    setSoloSubmitError('');
    setSoloScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setSoloScreenshotPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // Handle Player Input Changes
  const handlePlayerInputChange = (index, field, value) => {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Group Merchant details based on selected slot
  const selectedSlotMerchant = selectedSlot
    ? getUpiConfigForSlot(selectedSlot.slot_number)
    : UPI_ACCOUNTS.HRIDAY;

  const handleCopyUpi = (upiId) => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopySoloUpi = () => {
    navigator.clipboard.writeText(UPI_ACCOUNTS.SOLO.upiId);
    setSoloCopiedUpi(true);
    setTimeout(() => setSoloCopiedUpi(false), 2000);
  };

  // Submit Group Registration
  const handleSubmitGroupRegistration = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    if (playerCount !== 3 && playerCount !== 4) {
      setSubmitError('Group registration is strictly for 3 or 4 players.');
      return;
    }

    for (let i = 0; i < playerCount; i++) {
      const p = players[i];
      if (!p.name?.trim() || !p.email?.trim() || !p.phone?.trim()) {
        setSubmitError(`Please fill all details for Player ${i + 1} (${i === 0 ? 'Squad Captain' : 'Teammate'})`);
        return;
      }
    }

    if (!screenshotFile) {
      setSubmitError('Payment screenshot upload is mandatory to hold your squad slot.');
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
      fetchSlots();
    } catch (err) {
      console.error('Group registration failed:', err);
      setSubmitError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Solo Registration
  const handleSubmitSoloRegistration = async (e) => {
    e.preventDefault();

    if (!soloName.trim() || !soloEmail.trim() || !soloPhone.trim()) {
      setSoloSubmitError('Full name, email address, and phone number are required.');
      return;
    }

    if (!soloScreenshotFile) {
      setSoloSubmitError('Payment screenshot upload is mandatory to enter the solo player pool.');
      return;
    }

    setSoloSubmitting(true);
    setSoloSubmitError('');

    try {
      const created = await laserTagApi.registerSoloSlot({
        name: soloName.trim(),
        email: soloEmail.trim(),
        phone: soloPhone.trim(),
        preferredSlotId: soloPreferredSlot,
        utrReference: soloUtrReference,
        screenshotFile: soloScreenshotFile,
      });

      setCompletedBooking(created);
      setSoloName('');
      setSoloEmail('');
      setSoloPhone('');
      setSoloScreenshotFile(null);
      setSoloScreenshotPreview(null);
      setSoloUtrReference('');
      fetchSlots();
    } catch (err) {
      console.error('Solo registration failed:', err);
      setSoloSubmitError(err.message || 'Solo registration failed. Please try again.');
    } finally {
      setSoloSubmitting(false);
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

  // Dynamic UPI URIs
  const currentGroupUpiPayload = selectedSlot
    ? generateUpiPayload({
        upiId: selectedSlotMerchant.upiId,
        slotId: selectedSlot.slot_id,
        team: selectedTeam,
        playerCount,
      })
    : '';

  const soloUpiPayload = generateUpiPayload({
    upiId: UPI_ACCOUNTS.SOLO.upiId,
    slotId: soloPreferredSlot,
    team: 'SOLO_POOL',
    playerCount: 1,
  });

  const filteredSlots = selectedHour === 'ALL'
    ? slots
    : slots.filter((s) => s.hour_block === selectedHour);

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-[#3300FF] selection:text-white pb-32">
      <Navbar />

      {/* Cyberpunk Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20 pixel-grid-bg z-0" />

      {/* Hero Header Section */}
      <section className="relative z-10 pt-32 pb-14 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="border border-[#353535] bg-[#0c0c0c]/85 backdrop-blur-xl p-8 md:p-12 relative overflow-hidden">
          {/* Neon laser decorative line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#3300FF] via-[#00D4FF] to-[#FF0066]" />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 bg-[#3300FF]/15 border border-[#3300FF]/50 text-[#00D4FF] text-xs font-mono uppercase tracking-widest">
                <Crosshair size={14} className="animate-spin text-[#00D4FF]" />
                <span className="font-bold">DOTSLASH × GLITCH</span>
                <span className="text-[#71717A]">•</span>
                <span>FLAME University Arena</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold uppercase tracking-tight text-white font-headline-display">
                LASER TAG <span className="text-[#3300FF]">4v4</span> ARENA
              </h1>
              <p className="mt-3 text-[#A0A0A0] max-w-2xl font-mono text-sm leading-relaxed">
                15 continuous 20-minute skirmishes • 8:00 PM to 1:00 AM • ₹100 / Player.
                Register a squad of <strong className="text-white">strictly 3 or 4 players</strong>, or join the <strong className="text-[#00D4FF]">Solo Matchmaking Pool</strong> to be drafted into a balanced team!
              </p>
            </div>

            {/* Event Time Pill & Receipt Check */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="px-4 py-3 bg-[#131313] border border-[#353535] text-center font-mono">
                <span className="block text-[10px] text-[#A0A0A0] uppercase tracking-wider">Combat Window</span>
                <span className="text-[#00D4FF] font-bold text-sm">October 22, 2026</span>
                <span className="block text-[11px] text-white font-semibold">8:00 PM – 1:00 AM (15 Slots)</span>
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
                <span>Check Status</span>
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
              <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Match Length</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-1.5 mt-0.5">
                <Clock size={14} className="text-[#00D4FF]" /> 20 Min Continuous
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Entry Fee</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-1.5 mt-0.5">
                <Zap size={14} className="text-emerald-400" /> ₹100 / Person
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#A0A0A0] block">Rotating UPI</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-1.5 mt-0.5">
                <Sparkles size={14} className="text-amber-400" /> 3 Accounts (Anti-Block)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Registration Mode Switcher (Group vs Solo) */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2 bg-[#0c0c0c] border border-[#262626]">
          <button
            onClick={() => setRegistrationMode('GROUP')}
            className={`py-4 px-6 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition-all border ${
              registrationMode === 'GROUP'
                ? 'bg-[#181828] border-[#3300FF] text-white shadow-[0_0_20px_rgba(51,0,255,0.3)]'
                : 'border-transparent text-[#71717A] hover:text-white hover:bg-[#121212]'
            }`}
          >
            <Users size={18} className={registrationMode === 'GROUP' ? 'text-[#00D4FF]' : ''} />
            <div className="text-left">
              <span className="block font-bold text-sm">Group Registration</span>
              <span className="text-[11px] text-[#A0A0A0]">Strictly 3 or 4 Players (₹300 or ₹400)</span>
            </div>
          </button>

          <button
            onClick={() => setRegistrationMode('SOLO')}
            className={`py-4 px-6 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition-all border ${
              registrationMode === 'SOLO'
                ? 'bg-[#181828] border-[#00D4FF] text-white shadow-[0_0_20px_rgba(0,212,255,0.3)]'
                : 'border-transparent text-[#71717A] hover:text-white hover:bg-[#121212]'
            }`}
          >
            <User size={18} className={registrationMode === 'SOLO' ? 'text-amber-400' : ''} />
            <div className="text-left">
              <span className="block font-bold text-sm">Solo Registration (Pool)</span>
              <span className="text-[11px] text-[#A0A0A0]">1 Player (₹100) • We match you into a squad</span>
            </div>
          </button>
        </div>

        {/* Informational Banner */}
        <div className="mt-3 p-3 bg-[#111111] border border-[#222] font-mono text-xs text-[#A0A0A0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-[#00D4FF] shrink-0" />
            <span>
              {registrationMode === 'GROUP'
                ? 'Group Squad rule: To prevent partial fragmentation, groups must register with either 3 or 4 confirmed players. Solo players must use the Solo Registration tab.'
                : 'Solo Matchmaking rule: Register solo for ₹100 and pick your preferred slot. Organizers combine solo players into tactical 4-player teams.'}
            </span>
          </div>
          <span className="hidden md:inline font-bold text-white text-[10px] uppercase tracking-wider bg-[#1f1f1f] px-2 py-0.5 border border-[#333]">
            Rule Active
          </span>
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
                    <span>Booking Submitted • Screenshot Held for Verification</span>
                  </div>
                  <h3 className="text-2xl font-bold uppercase tracking-tight text-white font-headline-md">
                    Registration Receipt: {completedBooking.registration_id}
                  </h3>
                  <p className="text-emerald-200/80 font-mono text-xs mt-1 max-w-2xl leading-relaxed">
                    {completedBooking.registration_type === 'SOLO'
                      ? `Your solo spot has been submitted into the matchmaking pool. Preferred slot: ${completedBooking.preferred_slot_id || 'Flexible'}. Once verified, you will be assigned to a team.`
                      : `Your ${completedBooking.player_count} spots for ${completedBooking.team} (${completedBooking.slot_id}) are held awaiting admin screenshot approval. Once verified, your slot will transition to CONFIRMED.`}
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
        {/* ============================================================== */}
        {/* MODE 1: GROUP SQUAD REGISTRATION (3 OR 4 PLAYERS)             */}
        {/* ============================================================== */}
        {registrationMode === 'GROUP' && (
          <div>
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

              {/* Live Indicator */}
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
              /* 15-Slot Interactive Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSlots.map((slot) => {
                  const isSlotSelected = selectedSlot?.slot_id === slot.slot_id;
                  const slotNum = Number(slot.slot_number) || 1;
                  const merchant = getUpiConfigForSlot(slotNum);

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
                      <div className="p-5 border-b border-[#202020] bg-[#111111]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D4FF] font-bold">
                            Slot #{slot.slot_number} of 15
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-[#1b1b1b] border border-[#353535] text-[#A0A0A0]">
                            20 MIN MATCH
                          </span>
                        </div>

                        <h4 className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-2">
                          <Clock size={16} className="text-[#3300FF]" />
                          <span>{slot.time_window}</span>
                        </h4>

                        {/* Designated UPI Account Tag */}
                        <div className="mt-2 text-[10px] font-mono text-[#A0A0A0] flex items-center gap-1.5 bg-[#171717] px-2 py-1 border border-[#262626]">
                          <QrCode size={11} className="text-amber-400 shrink-0" />
                          <span className="truncate">
                            UPI Recipient: <strong className="text-white">{merchant.name}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Team Sides Area */}
                      <div className="p-5 space-y-4">
                        <TeamSideSelector
                          team={slot.team_a}
                          teamName="Team A"
                          isSelected={isSlotSelected && selectedTeam === 'Team A'}
                          onSelect={() => handleSelectSlotTeam(slot, 'Team A')}
                        />

                        <TeamSideSelector
                          team={slot.team_b}
                          teamName="Team B"
                          isSelected={isSlotSelected && selectedTeam === 'Team B'}
                          onSelect={() => handleSelectSlotTeam(slot, 'Team B')}
                        />
                      </div>

                      {/* Slot Footer indicator */}
                      <div className="px-5 py-2.5 bg-[#080808] border-t border-[#1a1a1a] flex items-center justify-between text-[11px] font-mono text-[#71717A]">
                        <span>Arena Limit: 8 spots</span>
                        <span>
                          {(slot.team_a.spots_left + slot.team_b.spots_left)} / 8 Available
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
                        <span>Squad Booking: Slot #{selectedSlot.slot_number} ({selectedSlot.time_window})</span>
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
                  <form onSubmit={handleSubmitGroupRegistration} className="p-6 md:p-8 space-y-8">
                    {/* 1. Squad Size Selector (Strictly 3 or 4 Players) */}
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-3">
                        1. Select Squad Size ({selectedTeam}) — Strictly 3 or 4 Players
                      </label>
                      <div className="grid grid-cols-2 gap-4 max-w-lg">
                        {[3, 4].map((count) => {
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
                                  ? 'border-[#00D4FF] bg-[#3300FF]/25 text-white shadow-[0_0_15px_rgba(0,212,255,0.3)]'
                                  : 'border-[#353535] bg-[#131313] text-[#A0A0A0] hover:border-[#52525B] hover:text-white'
                              }`}
                            >
                              <span className="block text-xl font-bold text-white">
                                {count} Players Squad
                              </span>
                              <span className="text-sm text-[#00D4FF] font-semibold mt-0.5 block">
                                ₹{count * 100} Total
                              </span>
                              {!isAvailable ? (
                                <span className="block text-[10px] text-red-400 mt-1">
                                  Only {side.spots_left} spot(s) remaining
                                </span>
                              ) : (
                                <span className="block text-[10px] text-emerald-400 mt-1">
                                  Eligible for slot lock
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
                        2. Squad Roster Details ({playerCount} Players)
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

                    {/* 3. Slot-Specific Rotating UPI QR & Payment Screenshot Upload */}
                    <div className="p-6 border border-[#252525] bg-[#0f0f0f]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-[#A0A0A0] flex items-center gap-2">
                          <span>3. UPI Settlement & Verification Screenshot</span>
                        </h3>
                        <span className="text-[11px] font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 border border-amber-800/40">
                          {selectedSlotMerchant.slotRange} Assigned to {selectedSlotMerchant.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Left: Dynamic QR Code Card */}
                        <div className="lg:col-span-5 bg-[#141414] border border-[#353535] p-6 text-center flex flex-col items-center">
                          <div className="text-[11px] font-mono uppercase text-[#A0A0A0] mb-1">
                            Payable Amount ({playerCount} Players)
                          </div>
                          <div className="text-3xl font-extrabold font-mono text-white mb-3">
                            ₹{playerCount * 100}
                          </div>

                          <div className="p-3 bg-white border-4 border-[#3300FF] rounded-sm mb-3 inline-block shadow-[0_0_20px_rgba(51,0,255,0.4)]">
                            <QRCodeSVG
                              value={currentGroupUpiPayload}
                              size={180}
                              level="M"
                              includeMargin={false}
                            />
                          </div>

                          {/* Merchant Account Details */}
                          <div className="w-full bg-[#080808] border border-[#303030] p-2.5 mb-3 text-left font-mono text-xs">
                            <span className="text-[10px] text-[#71717A] uppercase block">Designated Merchant</span>
                            <span className="text-white font-bold block">{selectedSlotMerchant.name}</span>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[#00D4FF] text-[11px] truncate pr-2">
                                {selectedSlotMerchant.upiId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyUpi(selectedSlotMerchant.upiId)}
                                className="flex items-center gap-1 px-2 py-0.5 bg-[#3300FF] hover:bg-[#00D4FF] text-white font-bold transition-colors text-[10px] uppercase shrink-0"
                              >
                                {copiedUpi ? <Check size={11} /> : <Copy size={11} />}
                                <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Mobile Pay Link */}
                          <a
                            href={currentGroupUpiPayload}
                            className="w-full py-3 px-4 bg-[#3300FF] hover:bg-[#00D4FF] text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors duration-300"
                          >
                            <ExternalLink size={14} />
                            <span>Pay Now via UPI App</span>
                          </a>
                          <span className="block text-[10px] font-mono text-[#71717A] mt-2">
                            Google Pay • PhonePe • Paytm • BHIM
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
                              Attach screenshot displaying transaction amount (₹{playerCount * 100}) and UPI reference. Slots are held provisionally upon upload.
                            </p>

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

                          {submitError && (
                            <div className="p-3 bg-red-950/50 border border-red-600/50 text-red-300 font-mono text-xs flex items-center gap-2">
                              <AlertCircle size={16} className="shrink-0" />
                              <span>{submitError}</span>
                            </div>
                          )}

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
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 2: SOLO REGISTRATION (MATCHMAKING POOL)                   */}
        {/* ============================================================== */}
        {registrationMode === 'SOLO' && (
          <div ref={soloFormRef} className="max-w-4xl mx-auto">
            <div className="border border-[#00D4FF]/40 bg-[#0d0d14] p-6 md:p-10 shadow-[0_0_30px_rgba(0,212,255,0.15)] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-[#3300FF]" />

              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#00D4FF] mb-2">
                <Sparkles size={16} />
                <span>Solo Warrior Matchmaking Pool • ₹100 Entry Fee</span>
              </div>

              <h2 className="text-3xl font-extrabold uppercase tracking-tight text-white font-headline-md">
                Register as a Solo Player
              </h2>
              <p className="mt-2 text-sm font-mono text-[#A0A0A0] leading-relaxed">
                Don't have a 3 or 4 player squad? No problem. Register solo, select your preferred 20-minute window, and our tournament marshals will draft you into a balanced 4-player team with other solo participants.
              </p>

              <form onSubmit={handleSubmitSoloRegistration} className="mt-8 space-y-6">
                {/* Contact Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={soloName}
                      onChange={(e) => setSoloName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full bg-[#050505] border border-[#353535] px-3.5 py-2.5 text-xs font-mono text-white placeholder-[#555] focus:border-[#00D4FF] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={soloEmail}
                      onChange={(e) => setSoloEmail(e.target.value)}
                      placeholder="e.g. alex@example.com"
                      className="w-full bg-[#050505] border border-[#353535] px-3.5 py-2.5 text-xs font-mono text-white placeholder-[#555] focus:border-[#00D4FF] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-2">
                      Phone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={soloPhone}
                      onChange={(e) => setSoloPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full bg-[#050505] border border-[#353535] px-3.5 py-2.5 text-xs font-mono text-white placeholder-[#555] focus:border-[#00D4FF] outline-none"
                    />
                  </div>
                </div>

                {/* Preferred Slot Selector */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-2">
                    Preferred Match Time Window (Subject to matchmaking availability)
                  </label>
                  <select
                    value={soloPreferredSlot}
                    onChange={(e) => setSoloPreferredSlot(e.target.value)}
                    className="w-full bg-[#050505] border border-[#353535] px-3.5 py-2.5 text-xs font-mono text-white focus:border-[#00D4FF] outline-none"
                  >
                    <option value="2026-10-22|SOLO_POOL">
                      Flexible / Any Time Slot (8:00 PM – 1:00 AM) — Recommended
                    </option>
                    {SLOT_SCHEDULE.map((s) => (
                      <option key={s.num} value={`2026-10-22|${s.start}`}>
                        Slot #{s.num}: {s.start} – {s.end}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Settlement Card for Solo (Hriday Goyal QR) */}
                <div className="p-6 bg-[#08080c] border border-[#262626]">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5 flex flex-col items-center text-center">
                      <div className="text-[11px] font-mono uppercase text-[#A0A0A0] mb-1">
                        Solo Registration Fee
                      </div>
                      <div className="text-3xl font-extrabold font-mono text-emerald-400 mb-3">
                        ₹100
                      </div>

                      <div className="p-2.5 bg-white border-2 border-[#00D4FF] rounded-sm mb-3 shadow-[0_0_15px_rgba(0,212,255,0.3)]">
                        <QRCodeSVG
                          value={soloUpiPayload}
                          size={150}
                          level="M"
                          includeMargin={false}
                        />
                      </div>

                      <div className="w-full bg-[#111] border border-[#2b2b2b] p-2 flex items-center justify-between font-mono text-xs">
                        <span className="text-[#A0A0A0] text-[11px] truncate pr-2">
                          {UPI_ACCOUNTS.SOLO.upiId}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopySoloUpi}
                          className="px-2 py-0.5 bg-[#00D4FF] text-black font-bold text-[10px] uppercase shrink-0"
                        >
                          {soloCopiedUpi ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      <a
                        href={soloUpiPayload}
                        className="w-full mt-2 py-2 px-3 bg-[#1e1e38] hover:bg-[#3300FF] text-white text-[11px] font-mono uppercase font-bold text-center block transition-colors"
                      >
                        Pay ₹100 via App
                      </a>
                    </div>

                    <div className="md:col-span-7 space-y-4">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-white mb-1.5 flex items-center gap-2">
                          <span>Upload Payment Screenshot (Mandatory)</span>
                          <span className="text-[10px] text-red-400">*Required</span>
                        </label>

                        {!soloScreenshotPreview ? (
                          <label className="border-2 border-dashed border-[#353535] hover:border-[#00D4FF] bg-[#050505] p-6 flex flex-col items-center justify-center cursor-pointer transition-colors group">
                            <UploadCloud
                              size={30}
                              className="text-[#71717A] group-hover:text-[#00D4FF] transition-colors mb-2"
                            />
                            <span className="font-mono text-xs text-white font-bold uppercase">
                              Click or Drag & Drop Screenshot
                            </span>
                            <span className="font-mono text-[10px] text-[#A0A0A0] mt-0.5">
                              PNG, JPG, WEBP (Max 5 MB)
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => handleSoloScreenshotChange(e.target.files?.[0])}
                            />
                          </label>
                        ) : (
                          <div className="relative border border-[#353535] bg-[#050505] p-3 flex items-center gap-4">
                            <img
                              src={soloScreenshotPreview}
                              alt="Payment Proof"
                              className="w-20 h-20 object-cover border border-[#252525]"
                            />
                            <div className="flex-1 min-w-0 font-mono text-xs">
                              <span className="text-emerald-400 font-bold block mb-1 flex items-center gap-1">
                                <CheckCircle2 size={13} /> Screenshot Ready
                              </span>
                              <span className="text-[#A0A0A0] block truncate">
                                {soloScreenshotFile?.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSoloScreenshotFile(null);
                                setSoloScreenshotPreview(null);
                              }}
                              className="p-1.5 text-red-400 hover:text-red-300 border border-red-500/30"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-1">
                          UTR / UPI Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={soloUtrReference}
                          onChange={(e) => setSoloUtrReference(e.target.value)}
                          placeholder="e.g. 12-digit transaction ID"
                          className="w-full bg-[#050505] border border-[#353535] px-3.5 py-2 text-xs font-mono text-white placeholder-[#555] focus:border-[#00D4FF] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {soloSubmitError && (
                  <div className="p-3 bg-red-950/50 border border-red-600/50 text-red-300 font-mono text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{soloSubmitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={soloSubmitting || !soloScreenshotFile}
                  className={`w-full py-4 px-6 font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    soloSubmitting || !soloScreenshotFile
                      ? 'bg-[#202020] text-[#666] border border-[#333] cursor-not-allowed'
                      : 'bg-[#00D4FF] hover:bg-[#3300FF] text-black hover:text-white shadow-[0_0_20px_rgba(0,212,255,0.4)]'
                  }`}
                >
                  {soloSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Submitting Solo Pool Entry...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      <span>Join Solo Matchmaking Pool (₹100)</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
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
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-[#00D4FF]">
                              {booking.registration_id}
                            </span>
                            <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-[#202020] border border-[#333] text-white">
                              {booking.registration_type === 'SOLO' ? 'Solo Matchmaking' : 'Group Squad'}
                            </span>
                          </div>
                          <BookingStatusBadge status={booking.booking_status} paymentStatus={booking.payment_status} />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                          <div>
                            <span className="text-[10px] text-[#71717A] uppercase block">Slot / Time Window</span>
                            <span className="text-white font-semibold">{booking.time_window}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#71717A] uppercase block">Team Assignment</span>
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

                        {/* Preferred Slot for Solo */}
                        {booking.registration_type === 'SOLO' && booking.preferred_slot_id && (
                          <div className="text-[11px] font-mono text-[#00D4FF] bg-[#161625] px-3 py-1.5 border border-[#3300FF]/30">
                            Preferred Time Slot requested: {booking.preferred_slot_id}
                          </div>
                        )}

                        {/* Captain Details */}
                        <div className="pt-2 text-xs font-mono text-[#A0A0A0] border-t border-[#1e1e1e] flex flex-wrap gap-x-6 gap-y-1">
                          <span>Name: <strong className="text-white">{booking.captain_name}</strong></span>
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
  const canFitGroup = team.spots_left >= 3;

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
        disabled={!canFitGroup}
        onClick={onSelect}
        className={`w-full py-2 px-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
          !canFitGroup
            ? 'bg-[#151515] text-[#555] cursor-not-allowed border border-[#222]'
            : isSelected
            ? 'bg-[#00D4FF] text-black font-extrabold'
            : 'bg-[#1a1a1a] hover:bg-[#3300FF] text-white border border-[#303030] hover:border-[#3300FF]'
        }`}
      >
        <span>
          {!canFitGroup
            ? team.spots_left > 0
              ? 'Fits Solo only (<3 open)'
              : 'Full / Held'
            : isSelected
            ? 'Selected'
            : 'Book Squad (3–4)'}
        </span>
        {canFitGroup && !isSelected && <ChevronRight size={12} />}
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
