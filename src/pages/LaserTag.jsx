import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Volume2,
  VolumeX,
  Play,
  Film,
  Radio,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LaserTagIntroModal from '../components/LaserTagIntroModal';
import MinimalistClockSelector from '../components/MinimalistClockSelector';
import { laserTagApi } from '../lib/laserTagApi';
import {
  DEFAULT_UPI_ID,
  generateUpiPayload,
  getDefaultSlots,
  getUpiConfigForSlot,
  SLOT_SCHEDULE,
  UPI_ACCOUNTS,
} from '../lib/laserTagService';

export default function LaserTag() {
  const [slots, setSlots] = useState(() => getDefaultSlots());
  const [loading, setLoading] = useState(true);
  const [activeClockSlot, setActiveClockSlot] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // CINEMATIC INTRO VIDEO STATE (1st visit per session, or manually triggered)
  const [isPlayingIntro, setIsPlayingIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('dotslash_lasertag_intro_seen');
    }
    return true;
  });
  const [replayKey, setReplayKey] = useState(0);

  const handleIntroComplete = useCallback(() => {
    setIsPlayingIntro(false);
    try {
      sessionStorage.setItem('dotslash_lasertag_intro_seen', 'true');
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  const handleReplayIntro = () => {
    setReplayKey((k) => k + 1);
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
  const [soloSlotFullWarning, setSoloSlotFullWarning] = useState('');
  const [soloUtrReference, setSoloUtrReference] = useState('');
  const [soloScreenshotFile, setSoloScreenshotFile] = useState(null);
  const [soloScreenshotPreview, setSoloScreenshotPreview] = useState(null);
  const [soloSubmitting, setSoloSubmitting] = useState(false);
  const [soloSubmitError, setSoloSubmitError] = useState('');
  const [soloCopiedUpi, setSoloCopiedUpi] = useState(false);

  // Auto-fallback to Flexible if preferred slot becomes full or is full
  useEffect(() => {
    if (soloPreferredSlot && soloPreferredSlot !== '2026-10-22|SOLO_POOL') {
      const targetSlot = slots.find(
        (s) => s.slot_id === soloPreferredSlot || s.slot_id.endsWith(soloPreferredSlot.replace('2026-10-22|', ''))
      );
      if (targetSlot) {
        const aOpen = targetSlot.team_a?.spots_left ?? 4;
        const bOpen = targetSlot.team_b?.spots_left ?? 4;
        if (aOpen + bOpen === 0) {
          setSoloPreferredSlot('2026-10-22|SOLO_POOL');
          setSoloSlotFullWarning(
            `Slot #${targetSlot.slot_number} (${targetSlot.time_window}) is completely full (8/8 spots booked). Your preference was automatically switched to Flexible.`
          );
        }
      }
    }
  }, [slots, soloPreferredSlot]);

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
      if (data && data.length) {
        setSlots(data);
      }
    } catch (err) {
      console.warn('Failed to fetch slots from API, preserving defaults:', err);
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

  const handleClockSelectSlot = useCallback((slot) => {
    setActiveClockSlot(slot);
    setSelectedSlot((prev) => (prev ? slot : null));
  }, []);

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

    // Verify requested preferred slot is not completely full
    if (soloPreferredSlot && soloPreferredSlot !== '2026-10-22|SOLO_POOL') {
      const chosen = slots.find(
        (s) => s.slot_id === soloPreferredSlot || s.slot_id.endsWith(soloPreferredSlot.replace('2026-10-22|', ''))
      );
      if (chosen) {
        const totalOpen = (chosen.team_a?.spots_left ?? 4) + (chosen.team_b?.spots_left ?? 4);
        if (totalOpen === 0) {
          setSoloSubmitError(
            `Slot #${chosen.slot_number} (${chosen.time_window}) is completely full (8/8 spots booked). You cannot set preference to an already full slot. Please select an open slot or choose Flexible.`
          );
          setSoloPreferredSlot('2026-10-22|SOLO_POOL');
          return;
        }
      }
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


  return (
    <div className="min-h-screen bg-[#FFF8E7] text-[#031844] selection:bg-[#52279B] selection:text-white pb-32 relative overflow-x-hidden">
      {/* ============================================================== */}
      {/* 1. CINEMATIC VIDEO INTRO MODAL (ISOLATED ZERO-RERENDER)        */}
      {/* ============================================================== */}
      <LaserTagIntroModal
        key={replayKey}
        isOpen={isPlayingIntro}
        onClose={handleIntroComplete}
      />

      {/* ============================================================== */}
      {/* 2. SEAMLESS LIGHT BACKGROUND                                   */}
      {/* ============================================================== */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        {/* Soft butter-cream base matching DotSlash */}
        <div className="absolute inset-0 bg-[#FFF8E7]" />
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#031844_1px,transparent_1px)] [background-size:16px_16px]" />
      </div>

      {/* ============================================================== */}
      {/* 3. HERO SECTION (DOTSLASH LIGHT AESTHETIC)                     */}
      {/* ============================================================== */}
      <section className="relative z-10 pt-36 pb-12 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="border-2 border-[#031844] bg-[#FFFFFF] p-8 sm:p-12 md:p-14 relative overflow-hidden shadow-[0_10px_35px_-10px_rgba(3,24,68,0.1)] rounded-3xl">
          {/* Royal Purple Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#52279B]" />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              {/* Brand Tag - Minimal & Clean */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 bg-[#8AF100]/25 border border-[#8AF100] text-xs font-mono uppercase tracking-widest text-[#031844] font-bold rounded-full">
                <span className="w-2 h-2 rounded-full bg-[#8AF100] animate-pulse" />
                <span className="font-bold tracking-widest">DOTSLASH × GLITCH</span>
                <span className="text-[#031844]/30">•</span>
                <span className="text-[#52279B] font-extrabold">4v4 ARENA</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-extrabold uppercase tracking-tight text-[#031844] font-headline-display">
                LASER TAG <span className="text-[#52279B]">4v4</span> ARENA
              </h1>

              {/* Streamlined 2-Line Description */}
              <p className="mt-4 text-[#031844]/80 max-w-2xl font-mono text-sm leading-relaxed">
                15 continuous 20-minute skirmishes (8:00 PM – 1:00 AM) • ₹100 / Player.
                <span className="block mt-1.5 text-[#031844] font-semibold">
                  Strictly 10 min play, 5 min setup, and 5 min wrap-up. Rotate the chronometer to pick your match hour.
                </span>
              </p>
            </div>

            {/* Event Time Pill, Cinematic Replay, and Status Check */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="px-5 py-4 bg-[#FFF8E7] border-2 border-[#031844] rounded-2xl text-center font-mono">
                <span className="block text-[10px] text-[#031844]/60 uppercase tracking-wider font-semibold">Combat Window</span>
                <span className="text-[#031844] font-bold text-sm block mt-0.5">October 22, 2026</span>
                <span className="block text-[11px] text-[#031844]/80 mt-0.5">8:00 PM – 1:00 AM (15 Slots)</span>
                <span className="block text-[10px] text-[#52279B] font-bold mt-1">10m Play • 5m Setup • 5m Wrap-up</span>
                <span className="block text-[10px] text-[#031844] font-semibold mt-1 pt-1 border-t border-[#031844]/15">
                  Learning Commons A&B
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleReplayIntro}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FFFFFF] hover:bg-[#FEDC36] text-[#031844] border-2 border-[#031844] shadow-[0_3px_0_0_#031844] active:translate-y-0.5 active:shadow-none text-xs font-mono uppercase tracking-wider font-bold transition-all rounded-xl cursor-pointer"
                  title="Replay Cinematic Briefing Video"
                >
                  <Play size={13} className="text-[#031844]" />
                  <span>Replay Briefing</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowLookupModal(true);
                    setLookupResults(null);
                    setLookupError('');
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FFF8E7] hover:bg-[#FFFFFF] text-[#031844] border-2 border-[#031844] shadow-[0_3px_0_0_#031844] active:translate-y-0.5 active:shadow-none text-xs font-mono uppercase tracking-wider font-bold transition-all rounded-xl cursor-pointer"
                >
                  <Search size={13} />
                  <span>Check Status</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stat Bar (Bento Metrics) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-10 pt-8 border-t border-[#031844]/15">
            <div className="p-4 bg-[#FFF8E7] border border-[#031844]/20 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-[#031844]/60 font-semibold block">Combat Format</span>
              <span className="text-[#031844] font-mono font-bold text-base flex items-center gap-2 mt-1">
                <Shield size={15} className="text-[#52279B]" /> 4 vs 4 Tactical
              </span>
            </div>
            <div className="p-4 bg-[#FFF8E7] border border-[#031844]/20 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-[#031844]/60 font-semibold block">Slot Schedule (20m)</span>
              <span className="text-[#031844] font-mono font-bold text-base flex items-center gap-1.5 mt-1">
                <Clock size={15} className="text-[#8AF100] fill-[#031844]" /> 10m Play Time
              </span>
              <span className="text-[10px] text-[#031844]/70 font-mono block mt-0.5">
                5m Setup • 5m Wrap-up
              </span>
            </div>
            <div className="p-4 bg-[#FFF8E7] border border-[#031844]/20 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-[#031844]/60 font-semibold block">Entry Fee</span>
              <span className="text-[#031844] font-mono font-bold text-base flex items-center gap-2 mt-1">
                <Zap size={15} className="text-[#FEDC36] fill-[#FEDC36]" /> ₹100 / Person
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. INTERACTIVE MINIMALIST CLOCK SELECTOR                       */}
      {/* ============================================================== */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <MinimalistClockSelector
          slots={slots}
          selectedSlot={selectedSlot || activeClockSlot || slots[0]}
          onSelectSlot={handleClockSelectSlot}
          selectedTeam={selectedTeam}
          onSelectTeam={(team) => setSelectedTeam(team)}
          onBookSquad={(slot, team) => handleSelectSlotTeam(slot, team)}
          registrationMode={registrationMode}
          onModeChange={(mode) => {
            setRegistrationMode(mode);
            if (mode === 'SOLO') setSelectedSlot(null);
          }}
          soloPreferredSlot={soloPreferredSlot}
          onSelectSoloSlot={(slot) => {
            const aOpen = slot.team_a?.spots_left ?? 4;
            const bOpen = slot.team_b?.spots_left ?? 4;
            if (aOpen + bOpen === 0) return;
            setSoloPreferredSlot(`2026-10-22|${slot.start_time}`);
            setSoloSlotFullWarning('');
            setTimeout(() => {
              soloFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }}
        />
      </section>

      {/* ============================================================== */}
      {/* 5. SUCCESS BANNER RECEIPT (LIGHT THEME)                        */}
      {/* ============================================================== */}
      <AnimatePresence>
        {completedBooking && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 my-10 relative z-20"
          >
            <div className="p-8 sm:p-10 bg-[#FFFFFF] border-2 border-[#8AF100] rounded-3xl shadow-[0_10px_35px_-10px_rgba(3,24,68,0.1)] relative">
              <button
                onClick={() => setCompletedBooking(null)}
                className="absolute top-5 right-5 text-[#031844]/60 hover:text-[#031844] p-2 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#8AF100]/20 text-[#031844] text-xs font-mono uppercase tracking-widest border border-[#8AF100] font-bold rounded-full">
                    <CheckCircle2 size={15} className="text-[#031844]" />
                    <span>Booking Submitted • Screenshot Held for Verification</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#031844] font-headline">
                    Registration Receipt: {completedBooking.registration_id}
                  </h3>
                  <p className="text-[#031844]/80 font-mono text-xs max-w-2xl leading-relaxed">
                    {completedBooking.registration_type === 'SOLO'
                      ? `Your solo entry has been queued in the matchmaking pool. Preferred slot: ${completedBooking.preferred_slot_id || 'Flexible'}. Once verified, you will be assigned to a team.`
                      : `Your ${completedBooking.player_count} spots for ${completedBooking.team} (${completedBooking.slot_id}) are held awaiting admin screenshot approval. Once verified, your slot will transition to CONFIRMED.`}
                  </p>

                  {/* Explicit Timing Schedule & Registered Email Notice */}
                  <div className="mt-4 p-4 bg-[#FFF8E7] border border-[#031844]/20 rounded-2xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#031844] flex items-center gap-1.5">
                        <Clock size={14} className="text-[#52279B]" /> Slot Timing Schedule (20 Min Total)
                      </span>
                      <span className="text-[11px] font-mono text-[#031844]/70">
                        Please arrive 10 minutes prior for sensor fitting
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                      <div className="p-2.5 bg-[#FFFFFF] border border-[#031844]/15 rounded-xl text-center">
                        <span className="text-[10px] text-[#031844]/60 block uppercase font-medium">1. Gear-up & Calibration</span>
                        <span className="text-[#031844] font-extrabold text-sm block mt-0.5">5 Minutes Setup</span>
                      </div>
                      <div className="p-2.5 bg-[#FFFFFF] border border-[#031844]/15 rounded-xl text-center">
                        <span className="text-[10px] text-[#031844]/60 block uppercase font-medium">2. Active Arena Combat</span>
                        <span className="text-[#031844] font-extrabold text-sm block mt-0.5">10 Minutes Playing</span>
                      </div>
                      <div className="p-2.5 bg-[#FFFFFF] border border-[#031844]/15 rounded-xl text-center">
                        <span className="text-[10px] text-[#031844]/60 block uppercase font-medium">3. Debrief & Tally</span>
                        <span className="text-[#031844] font-extrabold text-sm block mt-0.5">5 Minutes Wrap-up</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#031844]/15 flex items-center gap-2 text-xs font-mono text-[#031844]">
                      <span className="text-[#52279B] font-bold">Venue:</span>
                      <span>DotSlash Laser Tag Arena (Learning Commons A&B), FLAME University Campus</span>
                    </div>

                    <div className="pt-1.5 border-t border-[#031844]/15 flex items-center gap-2 text-xs font-mono text-[#031844]">
                      <Mail size={14} className="text-[#52279B] shrink-0" />
                      <span>
                        Official confirmation pass & receipt will be sent to registered email: <strong className="underline">{completedBooking.captain_email || 'your registered email'}</strong> upon marshal approval.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(completedBooking.registration_id);
                      setCopiedRegId(true);
                      setTimeout(() => setCopiedRegId(false), 2000);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-[#8AF100] hover:bg-[#FEDC36] text-[#031844] border-2 border-[#031844] font-mono font-bold text-xs uppercase tracking-wider transition-colors shadow-[0_3px_0_0_#031844] active:translate-y-0.5 active:shadow-none rounded-xl cursor-pointer"
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
                    className="inline-flex items-center gap-2 px-5 py-3 bg-[#FFF8E7] hover:bg-[#FFFFFF] border-2 border-[#031844] text-[#031844] font-mono font-bold text-xs uppercase tracking-wider transition-colors rounded-xl cursor-pointer"
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
      {/* 6. MAIN CONTENT AREA: SQUAD ROSTER DRAWER & SOLO POOL          */}
      {/* ============================================================== */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* MODE 1: GROUP REGISTRATION */}
        {/* MODE 1: GROUP REGISTRATION */}
        {registrationMode === 'GROUP' && (
          <div>
            {/* Squad Roster Drawer */}
            <AnimatePresence>
              {selectedSlot && (
                <motion.section
                  ref={bookingRef}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mt-6 mb-16 border-2 border-[#031844] bg-[#FFFFFF] rounded-3xl shadow-[0_10px_35px_-10px_rgba(3,24,68,0.12)] relative overflow-hidden"
                >
                  {/* Purple Accent line */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#52279B]" />

                  {/* Header Bar */}
                  <div className="bg-[#FFF8E7] px-8 py-6 border-b-2 border-[#031844] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-[#52279B] uppercase tracking-wider font-bold">
                        <Crosshair size={15} />
                        <span>Squad Booking: Slot #{selectedSlot.slot_number} ({selectedSlot.time_window})</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#031844] font-headline mt-1.5">
                        {selectedSlot.time_window} • <span className="text-[#52279B]">{selectedTeam}</span>
                      </h2>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-xs font-mono">
                        <span className="px-3 py-1 bg-[#FFFFFF] border border-[#031844]/20 rounded-full text-[#031844] font-bold flex items-center gap-1.5">
                          <Clock size={12} className="text-[#52279B]" />
                          <span>20 Min Total: 10m Play • 5m Setup • 5m Wrap-up</span>
                        </span>
                        <span className="text-[#031844]/70 text-[11px] flex items-center gap-1 font-medium">
                          <Mail size={12} className="text-[#52279B]" />
                          <span>Receipt & pass dispatched to captain email upon verification</span>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedSlot(null)}
                      className="self-start sm:self-center p-2.5 text-[#031844]/70 hover:text-[#031844] border-2 border-[#031844]/20 hover:border-[#031844] hover:bg-[#FEDC36] rounded-xl transition-all cursor-pointer"
                      title="Close Booking Form"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Form Body */}
                  <form onSubmit={handleSubmitGroupRegistration} className="p-8 sm:p-12 space-y-10">
                    {/* 1. Squad Size Selector (Strictly 3 or 4 Players) */}
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-4 font-bold">
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
                              className={`p-6 border-2 rounded-2xl font-mono text-left transition-all cursor-pointer ${
                                !isAvailable
                                  ? 'opacity-35 border-[#031844]/15 bg-gray-100 cursor-not-allowed text-[#031844]/40'
                                  : playerCount === count
                                  ? 'border-[#031844] bg-[#FFF8E7] text-[#031844] shadow-[0_4px_0_0_#031844]'
                                  : 'border-[#031844]/20 bg-[#FFFFFF] text-[#031844]/70 hover:border-[#031844] hover:text-[#031844]'
                              }`}
                            >
                              <span className="block text-2xl font-extrabold text-[#031844]">
                                {count} Players Squad
                              </span>
                              <span className="text-base text-[#52279B] font-bold mt-1 block">
                                ₹{count * 100} Total (₹100/person)
                              </span>
                              {!isAvailable ? (
                                <span className="block text-[11px] text-red-600 mt-2 font-medium">
                                  Only {side.spots_left} spot(s) remaining
                                </span>
                              ) : (
                                <span className="block text-[11px] text-emerald-600 mt-2 font-bold">
                                  ✓ Eligible for slot lock
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Squad Roster Inputs */}
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-4 font-bold">
                        2. Squad Roster Details ({playerCount} Players)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {players.map((p, idx) => (
                          <div
                            key={idx}
                            className={`p-6 border-2 rounded-2xl transition-all ${
                              idx === 0
                                ? 'border-[#52279B] bg-[#FFF8E7]/40 shadow-sm'
                                : 'border-[#031844]/20 bg-[#FFFFFF]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <span className="font-mono text-xs font-extrabold uppercase text-[#031844] flex items-center gap-2">
                                <User size={14} className={idx === 0 ? 'text-[#52279B]' : 'text-[#031844]/60'} />
                                <span>Player {idx + 1} {idx === 0 ? '• Squad Captain' : ''}</span>
                              </span>
                              {idx === 0 && (
                                <span className="text-[10px] font-mono px-2.5 py-0.5 bg-[#52279B] text-white font-bold rounded-full">
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
                                  className="w-full bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3 text-xs font-mono text-[#031844] placeholder-[#031844]/40 focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] outline-none rounded-xl"
                                />
                              </div>
                              <div>
                                <input
                                  type="email"
                                  required
                                  value={p.email}
                                  onChange={(e) => handlePlayerInputChange(idx, 'email', e.target.value)}
                                  placeholder="Email Address"
                                  className="w-full bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3 text-xs font-mono text-[#031844] placeholder-[#031844]/40 focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] outline-none rounded-xl"
                                />
                              </div>
                              <div>
                                <input
                                  type="tel"
                                  required
                                  value={p.phone}
                                  onChange={(e) => handlePlayerInputChange(idx, 'phone', e.target.value)}
                                  placeholder="Phone / WhatsApp Number"
                                  className="w-full bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3 text-xs font-mono text-[#031844] placeholder-[#031844]/40 focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] outline-none rounded-xl"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Slot-Specific Rotating UPI QR & Payment Screenshot Upload */}
                    <div className="p-8 sm:p-10 border-2 border-[#031844] bg-[#FFF8E7] rounded-3xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-[#031844] flex items-center gap-2 font-bold">
                          <span>3. UPI Settlement & Verification Screenshot</span>
                        </h3>
                        <span className="text-[11px] font-mono text-[#031844] bg-[#FFFFFF] px-3 py-1 border border-[#031844]/25 rounded-full font-bold">
                          Official Arena Gateway • {selectedSlotMerchant.slotRange}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                        {/* Left: Dynamic QR Code Card */}
                        <div className="lg:col-span-5 bg-[#FFFFFF] border-2 border-[#031844] rounded-2xl p-8 text-center flex flex-col items-center shadow-sm">
                          <div className="text-xs font-mono uppercase text-[#031844]/70 mb-1 font-semibold">
                            Payable Amount ({playerCount} Players)
                          </div>
                          <div className="text-4xl font-extrabold font-mono text-[#031844] mb-4">
                            ₹{playerCount * 100}
                          </div>

                          <div className="p-3.5 bg-white border-2 border-[#031844] rounded-xl mb-4 inline-block shadow-sm">
                            <QRCodeSVG
                              value={currentGroupUpiPayload}
                              size={180}
                              level="M"
                              includeMargin={false}
                            />
                          </div>

                          {/* Designated UPI Account Details */}
                          <div className="w-full bg-[#FFF8E7] border border-[#031844]/20 rounded-xl p-3.5 mb-4 text-left font-mono text-xs">
                            <span className="text-[10px] text-[#031844]/60 uppercase block font-bold">Designated UPI ID</span>
                            <div className="flex items-center justify-between mt-1.5 pt-1">
                              <span className="text-[#031844] text-xs font-bold truncate pr-2">
                                {selectedSlotMerchant.upiId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyUpi(selectedSlotMerchant.upiId)}
                                className="flex items-center gap-1.5 px-3 py-1 bg-[#8AF100] hover:bg-[#FEDC36] text-[#031844] font-extrabold transition-colors text-[10px] uppercase shrink-0 cursor-pointer rounded-lg border border-[#031844] shadow-sm"
                              >
                                {copiedUpi ? <Check size={12} /> : <Copy size={12} />}
                                <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Mobile Pay Link */}
                          <a
                            href={currentGroupUpiPayload}
                            className="w-full py-3.5 px-5 bg-[#8AF100] hover:bg-[#FEDC36] text-[#031844] text-xs font-mono font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 border-2 border-[#031844] shadow-[0_3px_0_0_#031844] active:translate-y-0.5 active:shadow-none rounded-xl"
                          >
                            <ExternalLink size={15} />
                            <span>Pay Now via UPI App</span>
                          </a>
                          <span className="block text-[11px] font-mono text-[#031844]/60 mt-3 font-medium">
                            Google Pay • PhonePe • Paytm • BHIM
                          </span>
                        </div>

                        {/* Right: Payment Screenshot Upload (Mandatory) + UTR Input */}
                        <div className="lg:col-span-7 space-y-6">
                          <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-2 flex items-center gap-2 font-bold">
                              <span>Upload Payment Screenshot (Mandatory)</span>
                              <span className="text-red-500 font-bold">*Required</span>
                            </label>

                            <p className="text-xs font-mono text-[#031844]/70 mb-4 leading-relaxed">
                              Attach screenshot displaying transaction amount (₹{playerCount * 100}) and UPI reference. Spots are provisionally held upon submission.
                            </p>

                            {!screenshotPreview ? (
                              <label className="border-2 border-dashed border-[#031844]/30 hover:border-[#52279B] bg-[#FFFFFF] p-10 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors group">
                                <UploadCloud
                                  size={40}
                                  className="text-[#031844]/40 group-hover:text-[#52279B] transition-colors mb-3"
                                />
                                <span className="font-mono text-xs text-[#031844] font-bold uppercase tracking-wider">
                                  Click or Drag & Drop Payment Screenshot
                                </span>
                                <span className="font-mono text-[11px] text-[#031844]/60 mt-1">
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
                              <div className="relative border-2 border-[#031844] bg-[#FFFFFF] rounded-2xl p-4 flex items-center gap-5">
                                <img
                                  src={screenshotPreview}
                                  alt="Payment Proof Preview"
                                  className="w-24 h-24 object-cover border-2 border-[#031844] rounded-xl"
                                />
                                <div className="flex-1 min-w-0 font-mono text-xs space-y-1">
                                  <span className="text-emerald-700 font-bold block flex items-center gap-1.5">
                                    <CheckCircle2 size={15} /> Screenshot Attached
                                  </span>
                                  <span className="text-[#031844] font-bold block truncate">
                                    {screenshotFile?.name}
                                  </span>
                                  <span className="text-[11px] text-[#031844]/60 block">
                                    {((screenshotFile?.size || 0) / 1024).toFixed(1)} KB
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setScreenshotFile(null);
                                    setScreenshotPreview(null);
                                  }}
                                  className="p-2 text-red-600 hover:text-red-700 border border-red-300 rounded-xl hover:bg-red-50 transition-colors bg-white cursor-pointer"
                                  title="Remove file"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-2 font-bold">
                              UTR / UPI Transaction ID (Optional but recommended)
                            </label>
                            <input
                              type="text"
                              value={utrReference}
                              onChange={(e) => setUtrReference(e.target.value)}
                              placeholder="e.g. 4287XXXXXXXX or 12-digit UPI Ref"
                              className="w-full bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3.5 text-xs font-mono text-[#031844] placeholder-[#031844]/40 focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] rounded-xl outline-none"
                            />
                          </div>

                          {/* Official Receipt & Timing Dispatch Notice */}
                          <div className="p-4 bg-[#FFFFFF] border border-[#031844]/20 rounded-xl font-mono text-xs text-[#031844] space-y-2">
                            <div className="flex items-center gap-2 text-[#031844] font-bold text-[11px]">
                              <Clock size={13} className="text-[#52279B] shrink-0" />
                              <span>20-Min Match: 10m Playing Time • 5m Setup & Calibration • 5m Wrap-up</span>
                            </div>
                            <div className="flex items-start gap-2 text-[#031844]/70 text-[11px] pt-1.5 border-t border-[#031844]/15">
                              <Mail size={13} className="text-[#52279B] shrink-0 mt-0.5" />
                              <span>
                                Official verification pass and receipt will be dispatched to squad captain email: <strong className="text-[#031844] underline">{players[0]?.email || 'Squad Captain Email'}</strong>.
                              </span>
                            </div>
                          </div>

                          {submitError && (
                            <div className="p-4 bg-red-50 border border-red-300 text-red-700 font-mono text-xs rounded-xl flex items-center gap-2.5">
                              <AlertCircle size={18} className="shrink-0" />
                              <span>{submitError}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={submitting || !screenshotFile}
                            className={`w-full py-4 px-6 font-mono font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 rounded-xl border-2 border-[#031844] transition-all duration-200 cursor-pointer ${
                              submitting || !screenshotFile
                                ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed shadow-none'
                                : 'bg-[#8AF100] hover:bg-[#FEDC36] text-[#031844] shadow-[0_4px_0_0_#031844] active:translate-y-0.5 active:shadow-none'
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
            <div className="border-2 border-[#031844] bg-[#FFFFFF] p-8 sm:p-12 shadow-[0_10px_35px_-10px_rgba(3,24,68,0.12)] rounded-3xl relative overflow-hidden">
              {/* Royal Purple Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#52279B]" />

              <div className="flex items-center gap-2.5 text-xs font-mono uppercase tracking-wider text-[#52279B] mb-3 font-bold">
                <Sparkles size={16} />
                <span>Solo Combatant Matchmaking Pool • ₹100 Entry Fee</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#031844] font-headline">
                Register as a Solo Player
              </h2>
              <p className="mt-3 text-sm font-mono text-[#031844]/80 leading-relaxed max-w-3xl">
                Don't have a 3 or 4 player squad? Register solo, select your preferred 20-minute window, and our tournament marshals will draft you into a balanced 4-player team with other solo participants.
              </p>

              {/* Explicit Timing Schedule Card & Registered Email Receipt Notice */}
              <div className="mt-6 p-4 sm:p-5 bg-[#FFF8E7] border border-[#031844]/20 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#031844] flex items-center gap-1.5">
                    <Clock size={14} className="text-[#52279B]" /> Match Schedule Breakdown (20 Min Total)
                  </span>
                  <span className="text-[11px] font-mono text-[#031844]/70">
                    Arrive 10 minutes prior for sensor fitting
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-3 bg-[#FFFFFF] border border-[#031844]/15 rounded-xl text-center">
                    <span className="text-[10px] text-[#031844]/60 block uppercase font-medium">1. Gear-up & Calibration</span>
                    <span className="text-[#031844] font-extrabold text-sm block mt-0.5">5 Minutes Setup</span>
                  </div>
                  <div className="p-3 bg-[#FFFFFF] border border-[#031844]/15 rounded-xl text-center">
                    <span className="text-[10px] text-[#031844]/60 block uppercase font-medium">2. Active Arena Combat</span>
                    <span className="text-[#031844] font-extrabold text-sm block mt-0.5">10 Minutes Playing</span>
                  </div>
                  <div className="p-3 bg-[#FFFFFF] border border-[#031844]/15 rounded-xl text-center">
                    <span className="text-[10px] text-[#031844]/60 block uppercase font-medium">3. Debrief & Tally</span>
                    <span className="text-[#031844] font-extrabold text-sm block mt-0.5">5 Minutes Wrap-up</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#031844]/15 flex items-center gap-2 text-xs font-mono text-[#031844]">
                  <Mail size={13} className="text-[#52279B] shrink-0" />
                  <span>
                    Official verified booking receipt will be dispatched to your registered email: <strong className="text-[#031844] underline">{soloEmail || 'your registered email'}</strong> upon approval.
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmitSoloRegistration} className="mt-8 space-y-8">
                {/* Contact Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-2.5 font-bold">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={soloName}
                      onChange={(e) => setSoloName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3 text-xs font-mono text-[#031844] placeholder-[#031844]/40 focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-2.5 font-bold">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={soloEmail}
                      onChange={(e) => setSoloEmail(e.target.value)}
                      placeholder="e.g. alex@example.com"
                      className="w-full bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3 text-xs font-mono text-[#031844] placeholder-[#031844]/40 focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-2.5 font-bold">
                      Phone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={soloPhone}
                      onChange={(e) => setSoloPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3 text-xs font-mono text-[#031844] placeholder-[#031844]/40 focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] rounded-xl outline-none"
                    />
                  </div>
                </div>

                {/* Preferred Slot Selector */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-2.5 font-bold flex items-center justify-between">
                    <span>Preferred Match Time Window</span>
                    <span className="text-[11px] text-[#52279B] font-semibold lowercase">Matchmaking availability</span>
                  </label>

                  {soloSlotFullWarning && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs font-mono flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="text-amber-600 shrink-0" />
                        <span>{soloSlotFullWarning}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSoloSlotFullWarning('')}
                        className="p-1 text-amber-600 hover:text-amber-900 rounded cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <select
                    value={soloPreferredSlot}
                    onChange={(e) => {
                      setSoloPreferredSlot(e.target.value);
                      setSoloSlotFullWarning('');
                    }}
                    className="w-full bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3.5 text-xs font-mono text-[#031844] focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] rounded-xl outline-none"
                  >
                    <option value="2026-10-22|SOLO_POOL">
                      Flexible / Any Time Slot (8:00 PM – 1:00 AM) — Recommended
                    </option>
                    {SLOT_SCHEDULE.map((s) => {
                      const slotData = slots.find(
                        (sl) => sl.slot_id === `2026-10-22|${s.start}` || Number(sl.slot_number) === s.num
                      );
                      const aOpen = slotData?.team_a?.spots_left ?? 4;
                      const bOpen = slotData?.team_b?.spots_left ?? 4;
                      const totalOpen = aOpen + bOpen;
                      const isFull = totalOpen === 0;

                      return (
                        <option
                          key={s.num}
                          value={`2026-10-22|${s.start}`}
                          disabled={isFull}
                          className={isFull ? 'text-gray-400 bg-gray-100 font-normal' : 'text-[#031844] font-bold'}
                        >
                          Slot #{s.num}: {s.start} – {s.end} {isFull ? '— FULL (0/8 Spots Open)' : `(${totalOpen}/8 spots open)`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Settlement Card for Solo */}
                <div className="p-8 sm:p-10 bg-[#FFF8E7] border-2 border-[#031844] rounded-3xl">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                    <div className="md:col-span-5 flex flex-col items-center text-center bg-[#FFFFFF] border-2 border-[#031844] rounded-2xl p-6 shadow-sm">
                      <div className="text-xs font-mono uppercase text-[#031844]/70 mb-1 font-semibold">
                        Solo Registration Fee
                      </div>
                      <div className="text-4xl font-extrabold font-mono text-[#031844] mb-4">
                        ₹100
                      </div>

                      <div className="p-3.5 bg-white border-2 border-[#031844] rounded-xl mb-4 shadow-sm inline-block">
                        <QRCodeSVG
                          value={soloUpiPayload}
                          size={160}
                          level="M"
                          includeMargin={false}
                        />
                      </div>

                      <div className="w-full bg-[#FFF8E7] border border-[#031844]/20 rounded-xl p-2.5 flex items-center justify-between font-mono text-xs">
                        <span className="text-[#031844] text-[11px] font-bold truncate pr-2">
                          {UPI_ACCOUNTS.SOLO.upiId}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopySoloUpi}
                          className="px-2.5 py-1 bg-[#8AF100] hover:bg-[#FEDC36] text-[#031844] font-extrabold text-[10px] uppercase shrink-0 transition-colors cursor-pointer rounded-lg border border-[#031844] shadow-sm"
                        >
                          {soloCopiedUpi ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      <a
                        href={soloUpiPayload}
                        className="w-full mt-3 py-3 px-4 bg-[#8AF100] hover:bg-[#FEDC36] text-[#031844] text-xs font-mono uppercase font-extrabold text-center block transition-all rounded-xl border-2 border-[#031844] shadow-[0_3px_0_0_#031844] active:translate-y-0.5 active:shadow-none"
                      >
                        Pay ₹100 via App
                      </a>
                    </div>

                    <div className="md:col-span-7 space-y-6">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-2 flex items-center gap-2 font-bold">
                          <span>Upload Payment Screenshot (Mandatory)</span>
                          <span className="text-red-500 font-bold">*Required</span>
                        </label>

                        {!soloScreenshotPreview ? (
                          <label className="border-2 border-dashed border-[#031844]/30 hover:border-[#52279B] bg-[#FFFFFF] p-8 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors group">
                            <UploadCloud
                              size={36}
                              className="text-[#031844]/40 group-hover:text-[#52279B] transition-colors mb-2.5"
                            />
                            <span className="font-mono text-xs text-[#031844] font-bold uppercase tracking-wider">
                              Click or Drag & Drop Screenshot
                            </span>
                            <span className="font-mono text-[11px] text-[#031844]/60 mt-1">
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
                          <div className="relative border-2 border-[#031844] bg-[#FFFFFF] rounded-2xl p-4 flex items-center gap-4">
                            <img
                              src={soloScreenshotPreview}
                              alt="Payment Proof"
                              className="w-20 h-20 object-cover border-2 border-[#031844] rounded-xl"
                            />
                            <div className="flex-1 min-w-0 font-mono text-xs space-y-1">
                              <span className="text-emerald-700 font-bold block flex items-center gap-1.5">
                                <CheckCircle2 size={14} /> Screenshot Ready
                              </span>
                              <span className="text-[#031844] font-bold block truncate">
                                {soloScreenshotFile?.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSoloScreenshotFile(null);
                                setSoloScreenshotPreview(null);
                              }}
                              className="p-1.5 text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 bg-white cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-[#031844] mb-2 font-bold">
                          UTR / UPI Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={soloUtrReference}
                          onChange={(e) => setSoloUtrReference(e.target.value)}
                          placeholder="e.g. 12-digit transaction ID"
                          className="w-full bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3 text-xs font-mono text-[#031844] placeholder-[#031844]/40 focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] rounded-xl outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Official Receipt & Timing Dispatch Notice */}
                <div className="p-4 bg-[#FFFFFF] border border-[#031844]/20 rounded-xl font-mono text-xs text-[#031844] space-y-2">
                  <div className="flex items-center gap-2 text-[#031844] font-bold text-[11px]">
                    <Clock size={13} className="text-[#52279B] shrink-0" />
                    <span>20-Min Match: 10m Playing Time • 5m Setup & Calibration • 5m Wrap-up</span>
                  </div>
                  <div className="flex items-start gap-2 text-[#031844]/70 text-[11px] pt-1.5 border-t border-[#031844]/15">
                    <Mail size={13} className="text-[#52279B] shrink-0 mt-0.5" />
                    <span>
                      Official verification pass and receipt will be dispatched to registered solo combatant email: <strong className="text-[#031844] underline">{soloEmail || 'registered solo email'}</strong>.
                    </span>
                  </div>
                </div>

                {soloSubmitError && (
                  <div className="p-4 bg-red-50 border border-red-300 text-red-700 font-mono text-xs rounded-xl flex items-center gap-2.5">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{soloSubmitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={soloSubmitting || !soloScreenshotFile}
                  className={`w-full py-4 px-6 font-mono font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 rounded-xl border-2 border-[#031844] transition-all cursor-pointer ${
                    soloSubmitting || !soloScreenshotFile
                      ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed shadow-none'
                      : 'bg-[#8AF100] hover:bg-[#FEDC36] text-[#031844] shadow-[0_4px_0_0_#031844] active:translate-y-0.5 active:shadow-none'
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#031844]/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#FFFFFF] border-2 border-[#031844] rounded-3xl shadow-2xl overflow-hidden relative"
            >
              {/* Royal Purple Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#52279B]" />

              {/* Modal Header */}
              <div className="px-8 py-5 bg-[#FFF8E7] border-b-2 border-[#031844] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Search size={18} className="text-[#52279B]" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#031844]">
                    Check Laser Tag Booking Status
                  </span>
                </div>
                <button
                  onClick={() => setShowLookupModal(false)}
                  className="p-1.5 text-[#031844]/60 hover:text-[#031844] hover:bg-[#FEDC36] rounded-xl transition-all cursor-pointer"
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
                    className="flex-1 bg-[#FFFFFF] border border-[#031844]/30 px-4 py-3.5 font-mono text-xs text-[#031844] placeholder-[#031844]/40 focus:border-[#52279B] focus:ring-1 focus:ring-[#52279B] rounded-xl outline-none"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading || !lookupQuery.trim()}
                    className="px-7 py-3.5 bg-[#8AF100] hover:bg-[#FEDC36] disabled:bg-gray-100 text-[#031844] disabled:text-gray-400 font-mono text-xs font-extrabold uppercase tracking-wider rounded-xl border-2 border-[#031844] shadow-[0_3px_0_0_#031844] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    {lookupLoading ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {lookupError && (
                  <p className="font-mono text-xs text-red-700 bg-red-50 p-4 border border-red-300 rounded-xl">
                    {lookupError}
                  </p>
                )}

                {/* Results List */}
                {lookupResults && lookupResults.length > 0 && (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {lookupResults.map((booking) => (
                      <div
                        key={booking.registration_id}
                        className="p-6 border-2 border-[#031844]/20 bg-[#FFF8E7] rounded-2xl space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#031844]/15 pb-4">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-extrabold text-base text-[#52279B]">
                              {booking.registration_id}
                            </span>
                            <span className="px-2.5 py-0.5 text-[10px] font-mono uppercase bg-[#FFFFFF] border border-[#031844]/20 text-[#031844] font-bold rounded-full">
                              {booking.registration_type === 'SOLO' ? 'Solo Matchmaking' : 'Group Squad'}
                            </span>
                          </div>
                          <BookingStatusBadge status={booking.booking_status} paymentStatus={booking.payment_status} />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                          <div>
                            <span className="text-[10px] text-[#031844]/60 uppercase block font-bold">Slot / Time Window</span>
                            <span className="text-[#031844] font-bold mt-0.5 block">{booking.time_window}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#031844]/60 uppercase block font-bold">Team Assignment</span>
                            <span className="text-[#031844] font-bold mt-0.5 block">{booking.team}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#031844]/60 uppercase block font-bold">Players</span>
                            <span className="text-[#031844] font-bold mt-0.5 block">{booking.player_count}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#031844]/60 uppercase block font-bold">Amount Paid</span>
                            <span className="text-emerald-700 font-extrabold mt-0.5 block">₹{booking.total_fee}</span>
                          </div>
                        </div>

                        {/* Preferred Slot for Solo */}
                        {booking.registration_type === 'SOLO' && booking.preferred_slot_id && (
                          <div className="text-xs font-mono text-[#52279B] bg-[#FFFFFF] px-3.5 py-2 border border-[#52279B]/30 rounded-xl font-bold">
                            Preferred Time Slot requested: {booking.preferred_slot_id}
                          </div>
                        )}

                        {/* Match Timing Breakdown & Email Receipt Notice */}
                        <div className="p-3.5 bg-[#FFFFFF] border border-[#031844]/15 rounded-xl font-mono text-xs space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[#031844] font-bold text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <Clock size={13} className="text-[#52279B]" />
                              <span>Match Schedule: 10m Playing Time • 5m Setup & Calibration • 5m Scoring Wrap-up</span>
                            </span>
                            <span className="text-[10px] text-[#031844]/60 uppercase">Arrive 10m Prior</span>
                          </div>
                          <div className="flex items-center gap-2 text-[#031844] text-[11px] pt-1.5 border-t border-[#031844]/15">
                            <span className="text-[#52279B] font-bold">Venue:</span>
                            <span>DotSlash Laser Tag Arena (Learning Commons A&B), FLAME University Campus</span>
                          </div>
                          <div className="flex items-center gap-2 text-[#031844]/70 text-[11px] pt-1.5 border-t border-[#031844]/15">
                            <Mail size={13} className="text-[#52279B] shrink-0" />
                            <span>
                              Official receipt & verification pass dispatched to: <strong className="text-[#031844] underline">{booking.captain_email}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Captain Details */}
                        <div className="pt-3 text-xs font-mono text-[#031844]/70 border-t border-[#031844]/15 flex flex-wrap gap-x-8 gap-y-1.5">
                          <span>Name: <strong className="text-[#031844]">{booking.captain_name}</strong></span>
                          <span>Email: <strong className="text-[#031844]">{booking.captain_email}</strong></span>
                          <span>Phone: <strong className="text-[#031844]">{booking.captain_phone}</strong></span>
                        </div>

                        {/* Admin Note if any */}
                        {booking.admin_note && (
                          <div className="p-3 bg-[#FFFFFF] border-l-4 border-[#52279B] font-mono text-xs text-[#031844] rounded-r-xl">
                            <span className="text-[10px] text-[#031844]/60 uppercase block font-bold">Admin Verification Note:</span>
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

// Subcomponent: Booking Status Badge for Receipts
function BookingStatusBadge({ status, paymentStatus }) {
  if (status === 'CONFIRMED' || paymentStatus === 'APPROVED') {
    return (
      <span className="px-3 py-1 bg-[#8AF100]/30 border-2 border-[#031844] text-[#031844] font-mono text-xs uppercase font-extrabold flex items-center gap-1.5 rounded-full">
        <CheckCircle2 size={13} className="text-[#031844]" />
        <span>CONFIRMED</span>
      </span>
    );
  }
  if (status === 'REJECTED' || paymentStatus === 'REJECTED') {
    return (
      <span className="px-3 py-1 bg-red-100 border-2 border-red-400 text-red-700 font-mono text-xs uppercase font-bold flex items-center gap-1.5 rounded-full">
        <AlertCircle size={13} />
        <span>REJECTED</span>
      </span>
    );
  }
  return (
    <span className="px-3 py-1 bg-[#FEDC36]/50 border-2 border-[#031844] text-[#031844] font-mono text-xs uppercase font-bold flex items-center gap-1.5 rounded-full">
      <Clock size={13} className="text-[#52279B]" />
      <span>PENDING SCREENSHOT APPROVAL</span>
    </span>
  );
}
