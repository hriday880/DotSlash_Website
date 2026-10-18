import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Clock, ChevronLeft, ChevronRight, Check, Sparkles, AlertCircle, X } from 'lucide-react';

// Guaranteed fallback slots for instant, offline, and load-safe interaction
const DEFAULT_SLOTS = [
  { slot_id: '2026-10-22|20:00', slot_number: 1, start_time: '20:00', end_time: '20:20', time_window: '8:00 PM – 8:20 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|20:20', slot_number: 2, start_time: '20:20', end_time: '20:40', time_window: '8:20 PM – 8:40 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|20:40', slot_number: 3, start_time: '20:40', end_time: '21:00', time_window: '8:40 PM – 9:00 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|21:00', slot_number: 4, start_time: '21:00', end_time: '21:20', time_window: '9:00 PM – 9:20 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|21:20', slot_number: 5, start_time: '21:20', end_time: '21:40', time_window: '9:20 PM – 9:40 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|21:40', slot_number: 6, start_time: '21:40', end_time: '22:00', time_window: '9:40 PM – 10:00 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|22:00', slot_number: 7, start_time: '22:00', end_time: '22:20', time_window: '10:00 PM – 10:20 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|22:20', slot_number: 8, start_time: '22:20', end_time: '22:40', time_window: '10:20 PM – 10:40 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|22:40', slot_number: 9, start_time: '22:40', end_time: '23:00', time_window: '10:40 PM – 11:00 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|23:00', slot_number: 10, start_time: '23:00', end_time: '23:20', time_window: '11:00 PM – 11:20 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|23:20', slot_number: 11, start_time: '23:20', end_time: '23:40', time_window: '11:20 PM – 11:40 PM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|23:40', slot_number: 12, start_time: '23:40', end_time: '00:00', time_window: '11:40 PM – 12:00 AM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|00:00', slot_number: 13, start_time: '00:00', end_time: '00:20', time_window: '12:00 AM – 12:20 AM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|00:20', slot_number: 14, start_time: '00:20', end_time: '00:40', time_window: '12:20 AM – 12:40 AM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
  { slot_id: '2026-10-22|00:40', slot_number: 15, start_time: '00:40', end_time: '01:00', time_window: '12:40 AM – 1:00 AM', team_a: { spots_left: 4, status: 'AVAILABLE' }, team_b: { spots_left: 4, status: 'AVAILABLE' } },
];

/**
 * MinimalistClockSelector
 * Uses direct trigonometric SVG coordinates for the clock hand (zero CSS/SVG transform bugs)
 * + requestAnimationFrame shortest-angle spring interpolation + Lenis scroll prevention.
 */
export default function MinimalistClockSelector({
  slots = [],
  selectedSlot,
  onSelectSlot,
  selectedTeam = 'Team A',
  onSelectTeam,
  onBookSquad,
  registrationMode = 'GROUP',
  onModeChange,
  soloPreferredSlot,
  onSelectSoloSlot,
}) {
  const dialRef = useRef(null);

  // Guarantee 15 slots are ALWAYS present even if API is loading or offline
  const effectiveSlots = slots && slots.length === 15 ? slots : DEFAULT_SLOTS;

  // Active index (0 to 14)
  const initialIndex = selectedSlot && selectedSlot.slot_number
    ? Math.max(0, Math.min(14, Number(selectedSlot.slot_number) - 1))
    : 0;
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [displayAngle, setDisplayAngle] = useState(initialIndex * 24);
  const [isDragging, setIsDragging] = useState(false);

  // Refs to allow unbroken drag tracking without listener teardowns
  const isDraggingRef = useRef(false);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const displayAngleRef = useRef(displayAngle);
  displayAngleRef.current = displayAngle;
  const effectiveSlotsRef = useRef(effectiveSlots);
  effectiveSlotsRef.current = effectiveSlots;
  const onSelectSlotRef = useRef(onSelectSlot);
  onSelectSlotRef.current = onSelectSlot;

  // Sync index from external prop only if slot_number actually changed outside of dragging
  const externalSlotNum = selectedSlot?.slot_number ? Number(selectedSlot.slot_number) : null;
  useEffect(() => {
    if (isDraggingRef.current) return;
    if (externalSlotNum !== null && externalSlotNum >= 1 && externalSlotNum <= 15) {
      const idx = externalSlotNum - 1;
      if (idx !== activeIndexRef.current) {
        activeIndexRef.current = idx;
        setActiveIndex(idx);
      }
    }
  }, [externalSlotNum]);

  // Smooth shortest-path animation towards target slot angle when not dragging
  useEffect(() => {
    if (isDragging) return;
    const targetAngle = (activeIndex * 24) % 360;
    let rafId = null;

    const animate = () => {
      const current = displayAngleRef.current;
      let diff = ((targetAngle - current + 540) % 360) - 180;
      if (Math.abs(diff) < 0.35) {
        displayAngleRef.current = targetAngle;
        setDisplayAngle(targetAngle);
        return;
      }
      const next = (current + diff * 0.28 + 360) % 360;
      displayAngleRef.current = next;
      setDisplayAngle(next);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [activeIndex, isDragging]);

  // Commit slot selection (updates active index and informs parent)
  const commitSlot = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(14, idx));
    activeIndexRef.current = clamped;
    setActiveIndex(clamped);
    if (onSelectSlotRef.current && effectiveSlotsRef.current[clamped]) {
      onSelectSlotRef.current(effectiveSlotsRef.current[clamped]);
    }
  }, []);

  // Compute angle from client coordinates (0 at 12 o'clock, clockwise)
  const calculateAngle = useCallback((clientX, clientY) => {
    if (!dialRef.current) return 0;
    const rect = dialRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let theta = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (theta < 0) theta += 360;
    return theta;
  }, []);

  // Continuous pointer update for zero-latency dragging
  const handlePointerUpdate = useCallback((clientX, clientY) => {
    if (typeof clientX !== 'number' || typeof clientY !== 'number' || Number.isNaN(clientX) || Number.isNaN(clientY)) {
      return;
    }
    const angle = calculateAngle(clientX, clientY);
    displayAngleRef.current = angle;
    setDisplayAngle(angle);

    // 24 deg per slot (slot 0 centered at 0 deg, range 348 to 12 deg)
    const normalized = (angle + 12) % 360;
    let slotIdx = Math.floor(normalized / 24);
    if (slotIdx >= 15 || slotIdx < 0) slotIdx = 0;

    if (slotIdx !== activeIndexRef.current) {
      activeIndexRef.current = slotIdx;
      setActiveIndex(slotIdx);
      if (onSelectSlotRef.current && effectiveSlotsRef.current[slotIdx]) {
        onSelectSlotRef.current(effectiveSlotsRef.current[slotIdx]);
      }
    }
  }, [calculateAngle]);

  // Pointer / Mouse / Touch start on Dial
  const handleDialPointerDown = useCallback((e) => {
    if (e.cancelable) e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);

    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    handlePointerUpdate(clientX, clientY);
  }, [handlePointerUpdate]);

  // Global window listeners (attached ONCE on mount) for mouse, pointer, and touch
  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingRef.current) return;
      if (e.cancelable) e.preventDefault();
      const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
      handlePointerUpdate(clientX, clientY);
    };

    const onUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, [handlePointerUpdate]);

  // Quick Step Button Handler (< / >)
  const handleStep = (direction) => {
    const nextIdx = (activeIndex + direction + 15) % 15;
    commitSlot(nextIdx);
  };

  const activeSlot = effectiveSlots[activeIndex] || effectiveSlots[0];
  const isSoloMode = registrationMode === 'SOLO';

  // Format 12-hour display for active slot
  const formatSlotTime = (slot) => {
    if (!slot) return '8:00 PM';
    return slot.time_window ? slot.time_window.split(' – ')[0] : '8:00 PM';
  };

  // Pure trigonometric coordinates for the clock hand (cannot fail in any browser)
  const handRad = (displayAngle - 90) * (Math.PI / 180);
  const tipX = 200 + 142 * Math.cos(handRad);
  const tipY = 200 + 142 * Math.sin(handRad);
  const traceStartX = 200 + 20 * Math.cos(handRad);
  const traceStartY = 200 + 20 * Math.sin(handRad);
  const traceEndX = 200 + 128 * Math.cos(handRad);
  const traceEndY = 200 + 128 * Math.sin(handRad);

  return (
    <div className="w-full max-w-5xl mx-auto my-10 select-none">
      {/* Mode Switcher Pill: Group Squad vs Solo Matchmaking */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex p-1.5 bg-[#FFFFFF] border-2 border-[#031844] rounded-2xl shadow-sm gap-2">
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('GROUP')}
            className={`px-5 py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              !isSoloMode
                ? 'bg-[#031844] text-[#FEDC36] shadow-sm'
                : 'text-[#031844]/70 hover:text-[#031844]'
            }`}
          >
            Squad Registration (3–4)
          </button>
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('SOLO')}
            className={`px-5 py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              isSoloMode
                ? 'bg-[#031844] text-[#FEDC36] shadow-sm'
                : 'text-[#031844]/70 hover:text-[#031844]'
            }`}
          >
            Solo Pool (₹100)
          </button>
        </div>
      </div>

      {/* Main Interactive Clock Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#FFFFFF] border-2 border-[#031844] rounded-3xl p-6 sm:p-10 shadow-[0_10px_35px_-10px_rgba(3,24,68,0.12)] relative overflow-hidden">
        {/* Decorative Top Accent Bar in Royal Purple */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#52279B]" />

        {/* ============================================================== */}
        {/* LEFT COLUMN: MINIMALIST CLOCK DIAL (7 Cols)                    */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 flex flex-col items-center">
          
          {/* Quick Prev / Next Step Bar */}
          <div className="w-full flex items-center justify-between mb-4 px-3 font-mono text-xs font-bold text-[#031844]/70">
            <button
              type="button"
              onClick={() => handleStep(-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#031844]/20 hover:border-[#031844] hover:bg-[#FFF8E7] text-[#031844] transition-all cursor-pointer active:scale-95"
            >
              <ChevronLeft size={14} />
              <span>Previous Slot</span>
            </button>

            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#52279B] hidden sm:inline">
              Drag needle or tap notch
            </span>

            <button
              type="button"
              onClick={() => handleStep(1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#031844]/20 hover:border-[#031844] hover:bg-[#FFF8E7] text-[#031844] transition-all cursor-pointer active:scale-95"
            >
              <span>Next Slot</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Clock Dial SVG Container with data-lenis-prevent & touch-none */}
          <div
            data-lenis-prevent
            className="relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] flex items-center justify-center select-none"
            style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <svg
              ref={dialRef}
              onPointerDown={handleDialPointerDown}
              onMouseDown={handleDialPointerDown}
              onTouchStart={handleDialPointerDown}
              className="w-full h-full cursor-grab active:cursor-grabbing select-none"
              style={{ touchAction: 'none' }}
              viewBox="0 0 400 400"
            >
              {/* Outer Subtle Dial Rings */}
              <circle cx="200" cy="200" r="185" fill="#FFF8E7" stroke="#031844" strokeWidth="2.5" opacity="0.45" />
              <circle cx="200" cy="200" r="160" fill="none" stroke="#031844" strokeWidth="1.5" strokeDasharray="3 6" opacity="0.3" />

              {/* 15 Slot Nodes & Tick Marks */}
              {Array.from({ length: 15 }).map((_, idx) => {
                const angle = idx * 24;
                const rad = (angle - 90) * (Math.PI / 180);
                const cx = 200;
                const cy = 200;
                const r = 142;

                const x = cx + r * Math.cos(rad);
                const y = cy + r * Math.sin(rad);

                const isHourTick = idx % 3 === 0;
                const isCurrent = idx === activeIndex;

                const slotData = effectiveSlots[idx];
                const totalSpots = slotData && slotData.team_a && slotData.team_b
                  ? (slotData.team_a.spots_left + slotData.team_b.spots_left)
                  : 8;
                
                // Color status dot: Lime Green (#8AF100) if 3+ spots, Yellow (#FEDC36) if 1-2, Muted (#E4E4E7) if 0
                let dotFill = '#8AF100';
                if (totalSpots <= 0) dotFill = '#E4E4E7';
                else if (totalSpots < 3) dotFill = '#FEDC36';
                if (isCurrent) dotFill = '#031844';

                // Hour labels
                const hourLabels = ['8 PM', '9 PM', '10 PM', '11 PM', '12 AM'];
                const hourLabel = isHourTick ? hourLabels[idx / 3] : null;

                const labelRad = (angle - 90) * (Math.PI / 180);
                const labelX = cx + (r - 28) * Math.cos(labelRad);
                const labelY = cy + (r - 28) * Math.sin(labelRad) + 4;

                return (
                  <g
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      commitSlot(idx);
                    }}
                    className="cursor-pointer group"
                  >
                    {/* Generous Touch / Click hit target */}
                    <circle cx={x} cy={y} r="20" fill="transparent" />

                    {/* Node Dot */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isCurrent ? 9 : isHourTick ? 7 : 5}
                      fill={dotFill}
                      stroke={isCurrent ? '#FEDC36' : '#031844'}
                      strokeWidth={isCurrent ? '3' : '2'}
                    />

                    {/* Hour Number at :00 marks */}
                    {hourLabel && (
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill="#031844"
                        fontFamily="Space Mono, monospace"
                        pointerEvents="none"
                      >
                        {hourLabel}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Clock Needle / Arm (Rendered via direct trigonometric coordinates) */}
              <g pointerEvents="none">
                {/* Midnight Blue Hand Body */}
                <line
                  x1="200"
                  y1="200"
                  x2={tipX}
                  y2={tipY}
                  stroke="#031844"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
                {/* Lime Green Luminescent Trace Line */}
                <line
                  x1={traceStartX}
                  y1={traceStartY}
                  x2={traceEndX}
                  y2={traceEndY}
                  stroke="#8AF100"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Center Pivot Ring */}
                <circle cx="200" cy="200" r="16" fill="#031844" />
                <circle cx="200" cy="200" r="7" fill="#FEDC36" />

                {/* Tactical Needle Pointer Tip */}
                <circle cx={tipX} cy={tipY} r="19" fill="#8AF100" opacity="0.25" />
                <circle cx={tipX} cy={tipY} r="13" fill="#031844" stroke="#8AF100" strokeWidth="3" />
                <circle cx={tipX} cy={tipY} r="5" fill="#FEDC36" />
              </g>

              {/* Center Digital HUD Badge (Live Time + Slot Number) */}
              <g pointerEvents="none">
                <rect x="114" y="222" width="172" height="52" rx="10" fill="#FFFFFF" stroke="#031844" strokeWidth="2" />
                <text
                  x="200"
                  y="243"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="800"
                  fill="#031844"
                  fontFamily="Montserrat, sans-serif"
                >
                  {activeSlot.time_window}
                </text>
                <text
                  x="200"
                  y="262"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#52279B"
                  letterSpacing="1.4"
                  fontFamily="Space Mono, monospace"
                >
                  {`SLOT ${activeSlot.slot_number < 10 ? '0' + activeSlot.slot_number : activeSlot.slot_number} OF 15`}
                </text>
              </g>
            </svg>
          </div>

          {/* Availability Legend */}
          <div className="flex items-center gap-5 mt-4 text-[11px] font-mono font-bold text-[#031844]/70">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8AF100] border border-[#031844]" />
              <span>Available (3+ spots)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FEDC36] border border-[#031844]" />
              <span>Filling Fast</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E4E4E7] border border-[#031844]" />
              <span>Full</span>
            </span>
          </div>

        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: SPLIT FOCUS CARD (5 Cols)                        */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 bg-[#FFF8E7] border-2 border-[#031844] rounded-2xl p-6 sm:p-7 shadow-sm">
          
          {/* Header Row */}
          <div className="flex items-center justify-between pb-3 border-b border-[#031844]/15 font-mono">
            <span className="px-2.5 py-1 rounded bg-[#031844] text-[#FEDC36] font-bold text-[11px] tracking-wider uppercase">
              Slot #{activeSlot.slot_number} • {formatSlotTime(activeSlot)}
            </span>
            <span className="text-xs font-bold text-[#52279B]">
              ₹100 / Person
            </span>
          </div>

          {/* Active Time Window */}
          <div className="my-4">
            <div className="text-[11px] font-mono text-[#031844]/60 uppercase tracking-wider font-semibold">
              Match Time Window
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#031844] font-headline mt-0.5">
              {activeSlot.time_window}
            </h2>

            {/* Mandatory 20-min timing breakdown pill */}
            <div className="mt-2.5 p-2.5 bg-[#FFFFFF] border border-[#031844]/15 rounded-lg flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-[#031844] flex items-center gap-1.5">
                <Clock size={13} className="text-[#52279B]" />
                <span>20 Min Match</span>
              </span>
              <span className="text-[11px] text-[#031844]/70">
                10m Play • 5m Setup • 5m Wrap-up
              </span>
            </div>

            {/* Venue Indicator */}
            <div className="mt-2 px-2.5 py-1.5 bg-[#FFFFFF] border border-[#031844]/15 rounded-lg flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#52279B] font-bold">📍 Arena Venue</span>
              <span className="text-[#031844] font-semibold">Learning Commons A&B, FLAME</span>
            </div>
          </div>

          {/* GROUP SQUAD MODE: Team A vs Team B Selectors */}
          {!isSoloMode ? (
            <div className="space-y-3 my-5 font-mono">
              {/* Team A Card */}
              <div
                onClick={() => onSelectTeam && onSelectTeam('Team A')}
                className={`p-3.5 bg-[#FFFFFF] rounded-xl cursor-pointer transition-all border-2 ${
                  selectedTeam === 'Team A'
                    ? 'border-[#031844] shadow-sm'
                    : 'border-[#031844]/20 hover:border-[#52279B]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#031844] flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#52279B]" />
                    <span>Team A</span>
                    {selectedTeam === 'Team A' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#031844] text-white rounded font-bold">
                        Selected
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-bold text-[#8AF100] bg-[#031844] px-2 py-0.5 rounded">
                    {activeSlot.team_a?.spots_left ?? 4}/4 Open
                  </span>
                </div>
                <p className="text-[11px] text-[#031844]/70 mt-1">
                  Ready for 3 or 4 Player Squad
                </p>
              </div>

              {/* Team B Card */}
              <div
                onClick={() => onSelectTeam && onSelectTeam('Team B')}
                className={`p-3.5 bg-[#FFFFFF] rounded-xl cursor-pointer transition-all border-2 ${
                  selectedTeam === 'Team B'
                    ? 'border-[#031844] shadow-sm'
                    : 'border-[#031844]/20 hover:border-[#52279B]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#031844] flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#031844]" />
                    <span>Team B</span>
                    {selectedTeam === 'Team B' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#031844] text-white rounded font-bold">
                        Selected
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-bold text-[#8AF100] bg-[#031844] px-2 py-0.5 rounded">
                    {activeSlot.team_b?.spots_left ?? 4}/4 Open
                  </span>
                </div>
                <p className="text-[11px] text-[#031844]/70 mt-1">
                  Ready for 3 or 4 Player Squad
                </p>
              </div>

              {/* Primary Group CTA */}
              <button
                type="button"
                onClick={() => onBookSquad && onBookSquad(activeSlot, selectedTeam)}
                className="w-full mt-4 py-3.5 px-6 rounded-xl bg-[#8AF100] hover:bg-[#FEDC36] text-[#031844] font-mono font-extrabold text-xs uppercase tracking-widest border-2 border-[#031844] shadow-[0_4px_0_0_#031844] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                Book Squad for {formatSlotTime(activeSlot)} ({selectedTeam}) ›
              </button>
            </div>
          ) : (() => {
            const activeOpenSpots = (activeSlot.team_a?.spots_left ?? 4) + (activeSlot.team_b?.spots_left ?? 4);
            const isSlotFull = activeOpenSpots === 0;

            return (
              /* SOLO POOL MODE: Set Preferred Window */
              <div className="my-5 p-4 bg-[#FFFFFF] border-2 border-[#031844] rounded-xl space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#52279B] uppercase">
                    <Sparkles size={14} />
                    <span>Solo Matchmaking Window</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isSlotFull 
                      ? 'bg-red-100 text-red-700 border border-red-300' 
                      : 'bg-[#8AF100]/30 text-[#031844] border border-[#031844]/20'
                  }`}>
                    {isSlotFull ? 'FULL • 0 Spots' : `${activeOpenSpots}/8 Spots Open`}
                  </span>
                </div>

                {isSlotFull ? (
                  <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle size={14} className="shrink-0 text-red-600" />
                      <span>Slot #{activeSlot.slot_number} is Completely Full</span>
                    </div>
                    <p className="text-[11px] text-red-600/90 leading-tight">
                      All 8/8 spots in this time window are booked or held. You cannot set an already full slot as your preference. Please rotate to an open slot or select Flexible below.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#031844]/80 leading-relaxed">
                    Preferred slot will be set to <strong className="text-[#031844]">Slot #{activeSlot.slot_number} ({activeSlot.time_window})</strong>. Arena marshals will draft you into a balanced 4-player squad.
                  </p>
                )}

                <button
                  type="button"
                  disabled={isSlotFull}
                  onClick={() => !isSlotFull && onSelectSoloSlot && onSelectSoloSlot(activeSlot)}
                  className={`w-full mt-2 py-3.5 px-6 rounded-xl font-mono font-extrabold text-xs uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${
                    isSlotFull
                      ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed shadow-none'
                      : 'bg-[#8AF100] hover:bg-[#FEDC36] text-[#031844] border-[#031844] shadow-[0_4px_0_0_#031844] active:translate-y-1 active:shadow-none cursor-pointer'
                  }`}
                >
                  {isSlotFull ? (
                    <>
                      <X size={16} />
                      <span>Slot Full (0/8 Spots Open)</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Set {formatSlotTime(activeSlot)} as Solo Preference (₹100)</span>
                    </>
                  )}
                </button>
              </div>
            );
          })()}

          <p className="text-[10px] text-center font-mono text-[#031844]/60 mt-3">
            Instant UPI reservation • Strictly non-refundable • Official pass dispatched to email upon marshal approval
          </p>

        </div>

      </div>
    </div>
  );
}
