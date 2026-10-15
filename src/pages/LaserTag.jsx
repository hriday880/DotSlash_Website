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
  Volume2,
  VolumeX,
  Play,
  Film,
  Radio,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LaserTagIntroModal from '../components/LaserTagIntroModal';
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

  // CINEMATIC INTRO VIDEO STATE (1st visit per session, or manually triggered)
  const [isPlayingIntro, setIsPlayingIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('dotslash_lasertag_intro_seen');
    }
    return true;
  });

  const handleIntroComplete = () => {
    setIsPlayingIntro(false);
    try {
      sessionStorage.setItem('dotslash_lasertag_intro_seen', 'true');
    } catch {
      // Ignore storage restrictions
    }
  };

  const handleReplayIntro = () => {
    setIsPlayingIntro(true);
  };

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
    const count = side.spots_left === 3 ? 3 : 4;
    handlePlayerCountChange(count);
    setSubmitError('');

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
    <div className="min-h-screen bg-[#050608] text-white selection:bg-[#3300FF] selection:text-white pb-32 relative overflow-x-hidden">
      {/* ============================================================== */}
      {/* 1. CINEMATIC VIDEO INTRO MODAL (ISOLATED ZERO-RERENDER)        */}
      {/* ============================================================== */}
      <LaserTagIntroModal
        isOpen={isPlayingIntro}
        onClose={handleIntroComplete}
      />

      {/* ============================================================== */}
      {/* 2. SEAMLESS BACKGROUND (LAST FRAME: frame_010.png)             */}
      {/* ============================================================== */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        {/* Exact same base image matching the video's last frame */}
        <img
          src="/laser_intro/bg_last_frame.png"
          alt="Arena Background"
          className="w-full h-full object-cover object-center pointer-events-none"
        />

        {/* Clean solid dark overlay without any gradients, allowing arena lighting to frost through glass cards */}
        <div className="absolute inset-0 bg-[#050608]/45" />

        {/* 4 Multi-Laser Ambient Glows (Red, Cyan, Green, Amber matching frame_010) */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#FF2A55]/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-[#00E5FF]/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/3 w-80 h-80 bg-[#00FF66]/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-[#FFB800]/15 rounded-full blur-[130px] pointer-events-none" />

        {/* Cyberpunk Grid Overlay */}
        <div className="absolute inset-0 opacity-15 pixel-grid-bg" />
      </div>

      <Navbar />

      {/* ============================================================== */}
      {/* 3. HERO SECTION (ELITE UI GLASSMORPHISM)                       */}
      {/* ============================================================== */}
      <section className="relative z-10 pt-36 pb-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="border border-white/20 bg-black/45 backdrop-blur-2xl p-8 sm:p-12 md:p-14 relative overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_20px_50px_rgba(0,0,0,0.7)]">
          {/* Solid neon accent line on top - NO GRADIENT */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#00D4FF] shadow-[0_0_12px_#00D4FF]" />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              {/* Brand Tag with 4 Laser Dots */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 mb-6 bg-black/40 border border-white/20 backdrop-blur-xl text-xs font-mono uppercase tracking-widest shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FF2A55] shadow-[0_0_8px_#FF2A55]" />
                  <span className="w-2 h-2 rounded-full bg-[#00D4FF] shadow-[0_0_8px_#00D4FF]" />
                  <span className="w-2 h-2 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66]" />
                  <span className="w-2 h-2 rounded-full bg-[#FFB800] shadow-[0_0_8px_#FFB800]" />
                </span>
                <span className="font-bold text-white tracking-widest">DOTSLASH × GLITCH</span>
                <span className="text-white/40">•</span>
                <span className="text-[#00D4FF]">4v4 ARENA</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-extrabold uppercase tracking-tight text-white font-headline-display">
                LASER TAG <span className="text-[#00D4FF]">4v4</span> ARENA
              </h1>
              <p className="mt-4 text-[#C0C0C8] max-w-2xl font-mono text-sm leading-relaxed">
                15 continuous 20-minute skirmishes • 8:00 PM to 1:00 AM • ₹100 / Player.
                Book a squad of <strong className="text-white">strictly 3 or 4 players</strong>, or enter the <strong className="text-[#00D4FF]">Solo Matchmaking Pool</strong> to be drafted into a balanced tactical team.
              </p>
            </div>

            {/* Event Time Pill, Cinematic Replay, and Status Check */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="px-5 py-4 bg-black/50 border border-white/20 backdrop-blur-2xl text-center font-mono shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
                <span className="block text-[10px] text-white/60 uppercase tracking-wider">Combat Window</span>
                <span className="text-[#00D4FF] font-bold text-sm">October 22, 2026</span>
                <span className="block text-[11px] text-white font-semibold mt-0.5">8:00 PM – 1:00 AM (15 Slots)</span>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleReplayIntro}
                  className="inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-black/50 hover:bg-[#00D4FF] hover:text-black border border-white/20 hover:border-[#00D4FF] text-white text-xs font-mono uppercase tracking-wider transition-all duration-300 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] group cursor-pointer"
                  title="Replay Cinematic Briefing Video"
                >
                  <Play size={13} className="text-[#00D4FF] group-hover:text-black" />
                  <span>Replay Briefing</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowLookupModal(true);
                    setLookupResults(null);
                    setLookupError('');
                  }}
                  className="inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-black/50 hover:bg-white hover:text-black border border-white/20 text-white text-xs font-mono uppercase tracking-wider transition-all duration-300 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] cursor-pointer"
                >
                  <Search size={13} />
                  <span>Check Status</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stat Bar (Bento Metrics) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-10 pt-10 border-t border-white/15">
            <div className="p-4 bg-white/[0.04] backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              <span className="text-[10px] font-mono uppercase text-white/60 block">Combat Format</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-2 mt-1">
                <Shield size={15} className="text-[#00D4FF]" /> 4 vs 4 Tactical
              </span>
            </div>
            <div className="p-4 bg-white/[0.04] backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              <span className="text-[10px] font-mono uppercase text-white/60 block">Match Length</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-2 mt-1">
                <Clock size={15} className="text-[#00FF66]" /> 20 Min Continuous
              </span>
            </div>
            <div className="p-4 bg-white/[0.04] backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              <span className="text-[10px] font-mono uppercase text-white/60 block">Entry Fee</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-2 mt-1">
                <Zap size={15} className="text-[#FFB800]" /> ₹100 / Person
              </span>
            </div>
            <div className="p-4 bg-white/[0.04] backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              <span className="text-[10px] font-mono uppercase text-white/60 block">Rotating Accounts</span>
              <span className="text-white font-mono font-bold text-base flex items-center gap-2 mt-1">
                <Sparkles size={15} className="text-[#FF2A55]" /> 3 UPI Nodes
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. MODE SWITCHER: GROUP SQUAD (3-4) VS SOLO POOL               */}
      {/* ============================================================== */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-black/45 backdrop-blur-2xl border border-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_12px_32px_rgba(0,0,0,0.6)]">
          <button
            onClick={() => setRegistrationMode('GROUP')}
            className={`py-5 px-6 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-4 transition-all border ${
              registrationMode === 'GROUP'
                ? 'bg-black/60 border-2 border-[#00D4FF] text-white shadow-[inset_0_1px_0_0_rgba(0,212,255,0.3),0_0_25px_rgba(0,212,255,0.25)] backdrop-blur-2xl'
                : 'border-transparent text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Users size={20} className={registrationMode === 'GROUP' ? 'text-[#00D4FF]' : ''} />
            <div className="text-left">
              <span className="block font-bold text-sm">Group Registration</span>
              <span className="text-[11px] text-white/60">Strictly 3 or 4 Players (₹300 or ₹400)</span>
            </div>
          </button>

          <button
            onClick={() => setRegistrationMode('SOLO')}
            className={`py-5 px-6 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-4 transition-all border ${
              registrationMode === 'SOLO'
                ? 'bg-black/60 border-2 border-[#FFB800] text-white shadow-[inset_0_1px_0_0_rgba(255,184,0,0.3),0_0_25px_rgba(255,184,0,0.25)] backdrop-blur-2xl'
                : 'border-transparent text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <User size={20} className={registrationMode === 'SOLO' ? 'text-[#FFB800]' : ''} />
            <div className="text-left">
              <span className="block font-bold text-sm">Solo Registration (Pool)</span>
              <span className="text-[11px] text-white/60">1 Player (₹100) • Drafted into a balanced squad</span>
            </div>
          </button>
        </div>

        {/* Informational Rule Pill */}
        <div className="mt-4 p-4 bg-black/45 border border-white/15 backdrop-blur-2xl font-mono text-xs text-white/70 flex items-center justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <HelpCircle size={15} className="text-[#00D4FF] shrink-0" />
            <span>
              {registrationMode === 'GROUP'
                ? 'Tactical Group rule: To prevent partial slot fragmentation, groups must register with strictly 3 or 4 confirmed players. Solo players must use the Solo Registration tab.'
                : 'Solo Matchmaking rule: Register solo for ₹100 and pick your preferred slot. Arena marshals combine solo players into tactical 4-player teams.'}
            </span>
          </div>
          <span className="hidden md:inline font-bold text-white text-[10px] uppercase tracking-wider bg-white/10 px-2.5 py-1 border border-white/20">
            Active
          </span>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 5. SUCCESS BANNER RECEIPT                                      */}
      {/* ============================================================== */}
      <AnimatePresence>
        {completedBooking && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-16 relative z-20"
          >
            <div className="p-8 sm:p-10 bg-emerald-950/40 backdrop-blur-3xl border-2 border-emerald-400/80 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.3),0_20px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(16,185,129,0.2)] relative">
              <button
                onClick={() => setCompletedBooking(null)}
                className="absolute top-5 right-5 text-emerald-400 hover:text-white p-2 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-mono uppercase tracking-widest border border-emerald-500/30">
                    <CheckCircle2 size={16} />
                    <span>Booking Submitted • Screenshot Held for Verification</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white font-headline-md">
                    Registration Receipt: {completedBooking.registration_id}
                  </h3>
                  <p className="text-emerald-200/90 font-mono text-xs max-w-2xl leading-relaxed">
                    {completedBooking.registration_type === 'SOLO'
                      ? `Your solo entry has been queued in the matchmaking pool. Preferred slot: ${completedBooking.preferred_slot_id || 'Flexible'}. Once verified, you will be assigned to a team.`
                      : `Your ${completedBooking.player_count} spots for ${completedBooking.team} (${completedBooking.slot_id}) are held awaiting admin screenshot approval. Once verified, your slot will transition to CONFIRMED.`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(completedBooking.registration_id);
                      setCopiedRegId(true);
                      setTimeout(() => setCopiedRegId(false), 2000);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-400 hover:bg-emerald-300 text-black font-mono font-bold text-xs uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
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
                    className="inline-flex items-center gap-2 px-5 py-3 bg-black/60 border border-emerald-500/50 hover:border-emerald-300 text-emerald-300 font-mono text-xs uppercase tracking-wider transition-colors backdrop-blur-xl cursor-pointer"
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

      {/* ============================================================== */}
      {/* 6. MAIN CONTENT AREA                                           */}
      {/* ============================================================== */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* MODE 1: GROUP REGISTRATION */}
        {registrationMode === 'GROUP' && (
          <div>
            {/* Hour Tabs & Controls - Spacious & Frosted */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 mb-12">
              <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                {HOUR_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedHour(tab.id)}
                    className={`px-5 py-3 font-mono text-xs uppercase tracking-wider whitespace-nowrap border transition-all duration-200 flex items-center gap-2.5 cursor-pointer ${
                      selectedHour === tab.id
                        ? 'bg-[#00D4FF] border-2 border-[#00D4FF] text-black font-extrabold shadow-[0_0_20px_rgba(0,212,255,0.45)]'
                        : 'bg-black/45 border border-white/20 text-white/70 hover:text-white hover:border-white/40 backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        selectedHour === tab.id ? 'bg-black/20 text-black' : 'bg-white/10 text-white/80'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Live Indicator */}
              <div className="flex items-center justify-end gap-3 font-mono text-xs text-white/70">
                <span className="flex items-center gap-2 bg-black/45 px-4 py-2.5 border border-white/20 backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white/80 font-medium">Live Capacity Sync</span>
                </span>
                <button
                  onClick={() => fetchSlots(true)}
                  disabled={refreshing}
                  className="p-2.5 bg-black/45 border border-white/20 hover:border-[#00D4FF] text-white/70 hover:text-white transition-colors backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] cursor-pointer"
                  title="Refresh availability"
                >
                  <RefreshCw size={15} className={refreshing ? 'animate-spin text-[#00D4FF]' : ''} />
                </button>
              </div>
            </div>

            {/* Loading Skeleton */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-72 bg-black/40 border border-white/15 animate-pulse backdrop-blur-2xl" />
                ))}
              </div>
            ) : (
              /* 15-Slot Interactive Grid - 32px Breathing Room */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredSlots.map((slot) => {
                  const isSlotSelected = selectedSlot?.slot_id === slot.slot_id;
                  const slotNum = Number(slot.slot_number) || 1;
                  const merchant = getUpiConfigForSlot(slotNum);

                  return (
                    <div
                      key={slot.slot_id}
                      className={`bg-black/45 backdrop-blur-2xl border transition-all duration-300 flex flex-col justify-between ${
                        isSlotSelected
                          ? 'border-2 border-[#00D4FF] shadow-[inset_0_1px_0_0_rgba(0,212,255,0.3),0_16px_40px_rgba(0,0,0,0.7),0_0_30px_rgba(0,212,255,0.25)]'
                          : 'border-white/20 hover:border-white/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_12px_32px_rgba(0,0,0,0.6)]'
                      }`}
                    >
                      {/* Slot Header */}
                      <div className="p-6 border-b border-white/15 bg-white/[0.03]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono uppercase tracking-widest text-[#00D4FF] font-bold">
                            Slot #{slot.slot_number} of 15
                          </span>
                          <span className="text-[10px] font-mono px-2.5 py-1 bg-black/50 border border-white/20 text-white/70 backdrop-blur-md">
                            20 MIN MATCH
                          </span>
                        </div>

                        <h4 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2.5">
                          <Clock size={18} className="text-[#00D4FF]" />
                          <span>{slot.time_window}</span>
                        </h4>

                        {/* Designated UPI Account Tag */}
                        <div className="mt-3 text-[11px] font-mono text-white/70 flex items-center gap-2 bg-black/50 px-3 py-1.5 border border-white/15 backdrop-blur-md">
                          <QrCode size={13} className="text-[#FFB800] shrink-0" />
                          <span className="truncate">
                            UPI Recipient: <strong className="text-white">{merchant.name}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Team Sides Area */}
                      <div className="p-6 space-y-4">
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
                      <div className="px-6 py-3.5 bg-black/50 border-t border-white/15 flex items-center justify-between text-xs font-mono text-white/60">
                        <span>Arena Limit: 8 spots</span>
                        <span className="font-semibold text-white/80">
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
                  className="mt-20 border-2 border-[#00D4FF] bg-black/50 backdrop-blur-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_25px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(0,212,255,0.2)] relative overflow-hidden"
                >
                  {/* Header Bar */}
                  <div className="bg-black/60 px-8 py-6 border-b border-white/15 backdrop-blur-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-[#00D4FF] uppercase tracking-wider font-semibold">
                        <Crosshair size={15} />
                        <span>Squad Booking: Slot #{selectedSlot.slot_number} ({selectedSlot.time_window})</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white font-headline-md mt-1.5">
                        {selectedSlot.time_window} • <span className="text-[#00D4FF]">{selectedTeam}</span>
                      </h2>
                    </div>

                    <button
                      onClick={() => setSelectedSlot(null)}
                      className="self-start sm:self-center p-2.5 text-white/70 hover:text-white border border-white/20 hover:border-white transition-colors bg-black/40 backdrop-blur-xl cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Form Body with generous breathing space */}
                  <form onSubmit={handleSubmitGroupRegistration} className="p-8 sm:p-12 space-y-12">
                    {/* 1. Squad Size Selector (Strictly 3 or 4 Players) */}
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-4 font-semibold">
                        1. Select Squad Size ({selectedTeam}) — Strictly 3 or 4 Players
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
                        {[3, 4].map((count) => {
                          const side = selectedTeam === 'Team A' ? selectedSlot.team_a : selectedSlot.team_b;
                          const isAvailable = count <= side.spots_left;

                          return (
                            <button
                              key={count}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => handlePlayerCountChange(count)}
                              className={`p-6 border-2 font-mono text-left transition-all backdrop-blur-xl cursor-pointer ${
                                !isAvailable
                                  ? 'opacity-30 border-white/10 bg-black/40 cursor-not-allowed text-white/40'
                                  : playerCount === count
                                  ? 'border-[#00D4FF] bg-[#00D4FF]/15 text-white shadow-[inset_0_1px_0_0_rgba(0,212,255,0.3),0_0_20px_rgba(0,212,255,0.25)]'
                                  : 'border-white/20 bg-black/45 text-white/70 hover:border-white/40 hover:text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
                              }`}
                            >
                              <span className="block text-2xl font-bold text-white">
                                {count} Players Squad
                              </span>
                              <span className="text-base text-[#00D4FF] font-semibold mt-1 block">
                                ₹{count * 100} Total
                              </span>
                              {!isAvailable ? (
                                <span className="block text-[11px] text-red-400 mt-2">
                                  Only {side.spots_left} spot(s) remaining
                                </span>
                              ) : (
                                <span className="block text-[11px] text-emerald-400 mt-2">
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
                      <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-4 font-semibold">
                        2. Squad Roster Details ({playerCount} Players)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {players.map((p, idx) => (
                          <div
                            key={idx}
                            className={`p-6 border backdrop-blur-2xl transition-all ${
                              idx === 0
                                ? 'border-[#00D4FF]/70 bg-black/55 shadow-[inset_0_1px_0_0_rgba(0,212,255,0.2),0_0_25px_rgba(0,212,255,0.15)]'
                                : 'border-white/20 bg-black/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <span className="font-mono text-xs font-bold uppercase text-white flex items-center gap-2">
                                <User size={14} className={idx === 0 ? 'text-[#00D4FF]' : 'text-white/60'} />
                                <span>Player {idx + 1} {idx === 0 ? '• Squad Captain' : ''}</span>
                              </span>
                              {idx === 0 && (
                                <span className="text-[10px] font-mono px-2.5 py-0.5 bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 font-bold">
                                  Primary Contact
                                </span>
                              )}
                            </div>

                            <div className="space-y-4">
                              <div>
                                <input
                                  type="text"
                                  required
                                  value={p.name}
                                  onChange={(e) => handlePlayerInputChange(idx, 'name', e.target.value)}
                                  placeholder="Full Name"
                                  className="w-full bg-black/60 border border-white/20 px-4 py-3 text-xs font-mono text-white placeholder-white/40 focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                                />
                              </div>
                              <div>
                                <input
                                  type="email"
                                  required
                                  value={p.email}
                                  onChange={(e) => handlePlayerInputChange(idx, 'email', e.target.value)}
                                  placeholder="Email Address"
                                  className="w-full bg-black/60 border border-white/20 px-4 py-3 text-xs font-mono text-white placeholder-white/40 focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                                />
                              </div>
                              <div>
                                <input
                                  type="tel"
                                  required
                                  value={p.phone}
                                  onChange={(e) => handlePlayerInputChange(idx, 'phone', e.target.value)}
                                  placeholder="Phone / WhatsApp Number"
                                  className="w-full bg-black/60 border border-white/20 px-4 py-3 text-xs font-mono text-white placeholder-white/40 focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Slot-Specific Rotating UPI QR & Payment Screenshot Upload */}
                    <div className="p-8 sm:p-10 border border-white/20 bg-black/45 backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-white/80 flex items-center gap-2 font-semibold">
                          <span>3. UPI Settlement & Verification Screenshot</span>
                        </h3>
                        <span className="text-[11px] font-mono text-[#FFB800] bg-black/60 px-3 py-1 border border-amber-500/40 backdrop-blur-md font-bold">
                          {selectedSlotMerchant.slotRange} Assigned to {selectedSlotMerchant.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                        {/* Left: Dynamic QR Code Card */}
                        <div className="lg:col-span-5 bg-black/60 border border-white/20 p-8 text-center flex flex-col items-center backdrop-blur-2xl shadow-2xl">
                          <div className="text-xs font-mono uppercase text-white/70 mb-1">
                            Payable Amount ({playerCount} Players)
                          </div>
                          <div className="text-4xl font-extrabold font-mono text-white mb-4">
                            ₹{playerCount * 100}
                          </div>

                          <div className="p-3.5 bg-white border-4 border-[#00D4FF] rounded-sm mb-4 inline-block shadow-[0_0_25px_rgba(0,212,255,0.4)]">
                            <QRCodeSVG
                              value={currentGroupUpiPayload}
                              size={180}
                              level="M"
                              includeMargin={false}
                            />
                          </div>

                          {/* Merchant Account Details */}
                          <div className="w-full bg-black/50 border border-white/15 p-3.5 mb-4 text-left font-mono text-xs backdrop-blur-md">
                            <span className="text-[10px] text-white/60 uppercase block font-semibold">Designated Merchant Node</span>
                            <span className="text-white font-bold block mt-0.5">{selectedSlotMerchant.name}</span>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                              <span className="text-[#00D4FF] text-xs font-semibold truncate pr-2">
                                {selectedSlotMerchant.upiId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyUpi(selectedSlotMerchant.upiId)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00D4FF] hover:bg-white text-black font-extrabold transition-colors text-[10px] uppercase shrink-0 cursor-pointer shadow-md"
                              >
                                {copiedUpi ? <Check size={12} /> : <Copy size={12} />}
                                <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Mobile Pay Link */}
                          <a
                            href={currentGroupUpiPayload}
                            className="w-full py-3.5 px-5 bg-[#00D4FF] hover:bg-white text-black text-xs font-mono font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(0,212,255,0.4)]"
                          >
                            <ExternalLink size={15} />
                            <span>Pay Now via UPI App</span>
                          </a>
                          <span className="block text-[11px] font-mono text-white/50 mt-3">
                            Google Pay • PhonePe • Paytm • BHIM
                          </span>
                        </div>

                        {/* Right: Payment Screenshot Upload (Mandatory) + UTR Input */}
                        <div className="lg:col-span-7 space-y-6">
                          <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-white mb-2 flex items-center gap-2 font-semibold">
                              <span>Upload Payment Screenshot (Mandatory)</span>
                              <span className="text-red-400 font-bold">*Required</span>
                            </label>
                            <p className="text-xs font-mono text-white/60 mb-4 leading-relaxed">
                              Attach screenshot displaying transaction amount (₹{playerCount * 100}) and UPI reference. Spots are provisionally held upon submission.
                            </p>

                            {!screenshotPreview ? (
                              <label className="border-2 border-dashed border-white/20 hover:border-[#00D4FF] bg-black/40 backdrop-blur-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors group">
                                <UploadCloud
                                  size={40}
                                  className="text-white/50 group-hover:text-[#00D4FF] transition-colors mb-3"
                                />
                                <span className="font-mono text-xs text-white font-bold uppercase tracking-wider">
                                  Click or Drag & Drop Payment Screenshot
                                </span>
                                <span className="font-mono text-[11px] text-white/50 mt-1">
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
                              <div className="relative border border-white/20 bg-black/60 backdrop-blur-2xl p-4 flex items-center gap-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
                                <img
                                  src={screenshotPreview}
                                  alt="Payment Proof Preview"
                                  className="w-24 h-24 object-cover border border-white/20"
                                />
                                <div className="flex-1 min-w-0 font-mono text-xs space-y-1">
                                  <span className="text-emerald-400 font-bold block flex items-center gap-1.5">
                                    <CheckCircle2 size={15} /> Screenshot Attached
                                  </span>
                                  <span className="text-white font-medium block truncate">
                                    {screenshotFile?.name}
                                  </span>
                                  <span className="text-[11px] text-white/50 block">
                                    {((screenshotFile?.size || 0) / 1024).toFixed(1)} KB
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setScreenshotFile(null);
                                    setScreenshotPreview(null);
                                  }}
                                  className="p-2 text-red-400 hover:text-red-300 border border-red-500/40 hover:border-red-400 transition-colors bg-red-950/30 cursor-pointer"
                                  title="Remove file"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2 font-semibold">
                              UTR / UPI Transaction ID (Optional but recommended)
                            </label>
                            <input
                              type="text"
                              value={utrReference}
                              onChange={(e) => setUtrReference(e.target.value)}
                              placeholder="e.g. 4287XXXXXXXX or 12-digit UPI Ref"
                              className="w-full bg-black/60 border border-white/20 px-4 py-3.5 text-xs font-mono text-white placeholder-white/40 focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                            />
                          </div>

                          {submitError && (
                            <div className="p-4 bg-red-950/50 border border-red-600/60 text-red-300 font-mono text-xs flex items-center gap-2.5 backdrop-blur-md">
                              <AlertCircle size={18} className="shrink-0" />
                              <span>{submitError}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={submitting || !screenshotFile}
                            className={`w-full py-4 px-6 font-mono font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer ${
                              submitting || !screenshotFile
                                ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                                : 'bg-[#00D4FF] hover:bg-white text-black shadow-[0_0_30px_rgba(0,212,255,0.5)]'
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

        {/* MODE 2: SOLO MATCHMAKING POOL */}
        {registrationMode === 'SOLO' && (
          <div ref={soloFormRef} className="max-w-4xl mx-auto my-12">
            <div className="border border-white/20 bg-black/50 backdrop-blur-3xl p-8 sm:p-12 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_25px_60px_rgba(0,0,0,0.85)] relative overflow-hidden">
              {/* Solid amber neon accent line - ZERO GRADIENTS */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FFB800] shadow-[0_0_12px_#FFB800]" />

              <div className="flex items-center gap-2.5 text-xs font-mono uppercase tracking-wider text-[#FFB800] mb-3 font-semibold">
                <Sparkles size={16} />
                <span>Solo Combatant Matchmaking Pool • ₹100 Entry Fee</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white font-headline-md">
                Register as a Solo Player
              </h2>
              <p className="mt-3 text-sm font-mono text-white/70 leading-relaxed max-w-3xl">
                Don't have a 3 or 4 player squad? Register solo, select your preferred 20-minute window, and our tournament marshals will draft you into a balanced 4-player team with other solo participants.
              </p>

              <form onSubmit={handleSubmitSoloRegistration} className="mt-10 space-y-8">
                {/* Contact Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2.5 font-semibold">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={soloName}
                      onChange={(e) => setSoloName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full bg-black/60 border border-white/20 px-4 py-3 text-xs font-mono text-white placeholder-white/40 focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2.5 font-semibold">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={soloEmail}
                      onChange={(e) => setSoloEmail(e.target.value)}
                      placeholder="e.g. alex@example.com"
                      className="w-full bg-black/60 border border-white/20 px-4 py-3 text-xs font-mono text-white placeholder-white/40 focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2.5 font-semibold">
                      Phone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={soloPhone}
                      onChange={(e) => setSoloPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full bg-black/60 border border-white/20 px-4 py-3 text-xs font-mono text-white placeholder-white/40 focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    />
                  </div>
                </div>

                {/* Preferred Slot Selector */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2.5 font-semibold">
                    Preferred Match Time Window (Subject to matchmaking availability)
                  </label>
                  <select
                    value={soloPreferredSlot}
                    onChange={(e) => setSoloPreferredSlot(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 px-4 py-3.5 text-xs font-mono text-white focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
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
                <div className="p-8 sm:p-10 bg-black/45 border border-white/20 backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                    <div className="md:col-span-5 flex flex-col items-center text-center">
                      <div className="text-xs font-mono uppercase text-white/70 mb-1">
                        Solo Registration Fee
                      </div>
                      <div className="text-4xl font-extrabold font-mono text-emerald-400 mb-4">
                        ₹100
                      </div>

                      <div className="p-3 bg-white border-4 border-[#00D4FF] rounded-sm mb-4 shadow-[0_0_20px_rgba(0,212,255,0.4)]">
                        <QRCodeSVG
                          value={soloUpiPayload}
                          size={160}
                          level="M"
                          includeMargin={false}
                        />
                      </div>

                      <div className="w-full bg-black/60 border border-white/15 p-2.5 flex items-center justify-between font-mono text-xs backdrop-blur-md">
                        <span className="text-white/80 text-[11px] truncate pr-2">
                          {UPI_ACCOUNTS.SOLO.upiId}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopySoloUpi}
                          className="px-2.5 py-1 bg-[#00D4FF] hover:bg-white text-black font-extrabold text-[10px] uppercase shrink-0 transition-colors cursor-pointer shadow-md"
                        >
                          {soloCopiedUpi ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      <a
                        href={soloUpiPayload}
                        className="w-full mt-3 py-2.5 px-4 bg-[#00D4FF] hover:bg-white text-black text-xs font-mono uppercase font-extrabold text-center block transition-all shadow-[0_0_15px_rgba(0,212,255,0.35)]"
                      >
                        Pay ₹100 via App
                      </a>
                    </div>

                    <div className="md:col-span-7 space-y-6">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-white mb-2 flex items-center gap-2 font-semibold">
                          <span>Upload Payment Screenshot (Mandatory)</span>
                          <span className="text-red-400 font-bold">*Required</span>
                        </label>

                        {!soloScreenshotPreview ? (
                          <label className="border-2 border-dashed border-white/20 hover:border-[#00D4FF] bg-black/40 backdrop-blur-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group">
                            <UploadCloud
                              size={36}
                              className="text-white/50 group-hover:text-[#00D4FF] transition-colors mb-2.5"
                            />
                            <span className="font-mono text-xs text-white font-bold uppercase tracking-wider">
                              Click or Drag & Drop Screenshot
                            </span>
                            <span className="font-mono text-[11px] text-white/50 mt-1">
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
                          <div className="relative border border-white/20 bg-black/60 backdrop-blur-2xl p-4 flex items-center gap-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
                            <img
                              src={soloScreenshotPreview}
                              alt="Payment Proof"
                              className="w-20 h-20 object-cover border border-white/20"
                            />
                            <div className="flex-1 min-w-0 font-mono text-xs space-y-1">
                              <span className="text-emerald-400 font-bold block flex items-center gap-1.5">
                                <CheckCircle2 size={14} /> Screenshot Ready
                              </span>
                              <span className="text-white font-medium block truncate">
                                {soloScreenshotFile?.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSoloScreenshotFile(null);
                                setSoloScreenshotPreview(null);
                              }}
                              className="p-1.5 text-red-400 hover:text-red-300 border border-red-500/40 hover:border-red-400 bg-red-950/30 cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2 font-semibold">
                          UTR / UPI Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={soloUtrReference}
                          onChange={(e) => setSoloUtrReference(e.target.value)}
                          placeholder="e.g. 12-digit transaction ID"
                          className="w-full bg-black/60 border border-white/20 px-4 py-3 text-xs font-mono text-white placeholder-white/40 focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {soloSubmitError && (
                  <div className="p-4 bg-red-950/50 border border-red-600/60 text-red-300 font-mono text-xs flex items-center gap-2.5 backdrop-blur-md">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{soloSubmitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={soloSubmitting || !soloScreenshotFile}
                  className={`w-full py-4 px-6 font-mono font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                    soloSubmitting || !soloScreenshotFile
                      ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                      : 'bg-[#FFB800] hover:bg-white text-black shadow-[0_0_25px_rgba(255,184,0,0.45)]'
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

      {/* ============================================================== */}
      {/* 7. BOOKING STATUS LOOKUP MODAL                                 */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showLookupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-black/60 backdrop-blur-3xl border border-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_30px_70px_rgba(0,0,0,0.9)] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-8 py-5 bg-black/70 border-b border-white/15 backdrop-blur-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Search size={18} className="text-[#00D4FF]" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                    Check Laser Tag Booking Status
                  </span>
                </div>
                <button
                  onClick={() => setShowLookupModal(false)}
                  className="p-1.5 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 space-y-6">
                <form onSubmit={handleLookup} className="flex gap-3">
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="Enter Registration ID, Captain Email, or Phone"
                    className="flex-1 bg-black/60 border border-white/20 px-4 py-3.5 font-mono text-xs text-white placeholder-white/40 focus:border-[#00D4FF] focus:bg-black/80 outline-none backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading || !lookupQuery.trim()}
                    className="px-7 py-3.5 bg-[#00D4FF] hover:bg-white disabled:bg-white/5 text-black disabled:text-white/30 font-mono text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_20px_rgba(0,212,255,0.4)]"
                  >
                    {lookupLoading ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {lookupError && (
                  <p className="font-mono text-xs text-red-300 bg-red-950/40 p-4 border border-red-800/50 backdrop-blur-md">
                    {lookupError}
                  </p>
                )}

                {/* Results List */}
                {lookupResults && lookupResults.length > 0 && (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {lookupResults.map((booking) => (
                      <div
                        key={booking.registration_id}
                        className="p-6 border border-white/15 bg-black/50 backdrop-blur-2xl space-y-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-bold text-base text-[#00D4FF]">
                              {booking.registration_id}
                            </span>
                            <span className="px-2.5 py-0.5 text-[10px] font-mono uppercase bg-white/10 border border-white/20 text-white font-semibold">
                              {booking.registration_type === 'SOLO' ? 'Solo Matchmaking' : 'Group Squad'}
                            </span>
                          </div>
                          <BookingStatusBadge status={booking.booking_status} paymentStatus={booking.payment_status} />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                          <div>
                            <span className="text-[10px] text-white/50 uppercase block font-semibold">Slot / Time Window</span>
                            <span className="text-white font-semibold mt-0.5 block">{booking.time_window}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-white/50 uppercase block font-semibold">Team Assignment</span>
                            <span className="text-white font-semibold mt-0.5 block">{booking.team}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-white/50 uppercase block font-semibold">Players</span>
                            <span className="text-white font-semibold mt-0.5 block">{booking.player_count}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-white/50 uppercase block font-semibold">Amount Paid</span>
                            <span className="text-emerald-400 font-bold mt-0.5 block">₹{booking.total_fee}</span>
                          </div>
                        </div>

                        {/* Preferred Slot for Solo */}
                        {booking.registration_type === 'SOLO' && booking.preferred_slot_id && (
                          <div className="text-xs font-mono text-[#00D4FF] bg-black/60 px-3.5 py-2 border border-[#00D4FF]/30 backdrop-blur-md">
                            Preferred Time Slot requested: {booking.preferred_slot_id}
                          </div>
                        )}

                        {/* Captain Details */}
                        <div className="pt-3 text-xs font-mono text-white/70 border-t border-white/10 flex flex-wrap gap-x-8 gap-y-1.5">
                          <span>Name: <strong className="text-white">{booking.captain_name}</strong></span>
                          <span>Email: <strong className="text-white">{booking.captain_email}</strong></span>
                          <span>Phone: <strong className="text-white">{booking.captain_phone}</strong></span>
                        </div>

                        {/* Admin Note if any */}
                        {booking.admin_note && (
                          <div className="p-3 bg-black/60 border-l-2 border-[#00D4FF] font-mono text-xs text-white/80 backdrop-blur-md">
                            <span className="text-[10px] text-white/50 uppercase block font-semibold">Admin Verification Note:</span>
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
      className={`p-4 border transition-all backdrop-blur-xl ${
        isSelected
          ? 'border-2 border-[#00D4FF] bg-[#00D4FF]/15 shadow-[inset_0_1px_0_0_rgba(0,212,255,0.3),0_0_20px_rgba(0,212,255,0.25)]'
          : 'border-white/15 bg-black/45 hover:border-white/35 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
      }`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-mono text-xs font-bold uppercase text-white flex items-center gap-2">
          <Shield
            size={14}
            className={teamName === 'Team A' ? 'text-[#00D4FF]' : 'text-[#FF2A55]'}
          />
          <span>{teamName}</span>
        </span>
        <span className="font-mono text-xs text-white/70">
          {team.spots_left}/4 Open
        </span>
      </div>

      {/* Status Badge */}
      <div className="mb-3.5">
        {isAvailable && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-[10px] uppercase font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            AVAILABLE (4/4 open)
          </span>
        )}
        {isOpen && (
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/15 border border-cyan-500/35 text-[#00D4FF] font-mono text-[10px] uppercase font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D4FF]" />
              OPEN ({team.spots_left}/4 left)
            </span>
            {team.pending_players > 0 && (
              <span className="block text-[10px] font-mono text-amber-300/90 mt-1">
                • {team.pending_players} held awaiting verification
              </span>
            )}
          </div>
        )}
        {isPending && (
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono text-[10px] uppercase font-semibold">
              <Clock size={11} />
              PENDING APPROVAL
            </span>
            <span className="block text-[10px] font-mono text-white/60 mt-1">
              Held provisionally awaiting screenshot
            </span>
          </div>
        )}
        {isFull && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/15 text-white/40 font-mono text-[10px] uppercase font-semibold">
            FINALIZED / FULL (0/4)
          </span>
        )}
      </div>

      {/* Select Button */}
      <button
        type="button"
        disabled={!canFitGroup}
        onClick={onSelect}
        className={`w-full py-2.5 px-3.5 font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
          !canFitGroup
            ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
            : isSelected
            ? 'bg-[#00D4FF] text-black font-extrabold shadow-[0_0_15px_rgba(0,212,255,0.4)]'
            : 'bg-black/50 hover:bg-[#00D4FF] hover:text-black text-white border border-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
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
        {canFitGroup && !isSelected && <ChevronRight size={13} />}
      </button>
    </div>
  );
}

// Subcomponent: Booking Status Badge for Receipts
function BookingStatusBadge({ status, paymentStatus }) {
  if (status === 'CONFIRMED' || paymentStatus === 'APPROVED') {
    return (
      <span className="px-3.5 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-xs uppercase font-bold flex items-center gap-1.5 backdrop-blur-md">
        <CheckCircle2 size={13} />
        <span>CONFIRMED</span>
      </span>
    );
  }
  if (status === 'REJECTED' || paymentStatus === 'REJECTED') {
    return (
      <span className="px-3.5 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-xs uppercase font-bold flex items-center gap-1.5 backdrop-blur-md">
        <AlertCircle size={13} />
        <span>REJECTED</span>
      </span>
    );
  }
  return (
    <span className="px-3.5 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono text-xs uppercase font-bold flex items-center gap-1.5 animate-pulse backdrop-blur-md">
      <Clock size={13} />
      <span>PENDING SCREENSHOT APPROVAL</span>
    </span>
  );
}
