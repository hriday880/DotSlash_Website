import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, ArrowRight, Crosshair } from 'lucide-react';

export default function LaserTagIntroModal({ isOpen, onClose }) {
  const [isMuted, setIsMuted] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const videoRef = useRef(null);
  const progressFillRef = useRef(null);
  const timeTextRef = useRef(null);
  const exitTimerRef = useRef(null);

  // Trigger smooth crossfade exit
  const handleExit = () => {
    if (isExiting) return;
    setIsExiting(true);

    // Freeze video on current frame to prevent end-of-stream flash/loop
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // Ignore playback pause errors
      }
    }

    // Allow the 700ms opacity crossfade into the page background before unmounting
    exitTimerRef.current = setTimeout(() => {
      onClose();
    }, 700);
  };

  // Keyboard shortcut: ESC to skip
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [isOpen, isExiting]);

  // Direct DOM time & progress updates: ZERO React re-renders for smooth 60fps
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime || 0;
    const total = videoRef.current.duration || 10;
    const pct = Math.min(100, Math.max(0, (current / total) * 100));

    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${pct}%`;
    }

    if (timeTextRef.current) {
      const curSec = Math.floor(current);
      const totSec = Math.floor(total);
      timeTextRef.current.textContent = `00:${curSec < 10 ? '0' : ''}${curSec} / 00:${totSec < 10 ? '0' : ''}${totSec}`;
    }
  };

  const handleToggleSound = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#050608] flex items-center justify-center overflow-hidden transition-opacity duration-700 ease-out select-none ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Underlying static last-frame image - guaranteed identical aspect & position */}
      <img
        src="/laser_intro/bg_last_frame.png"
        alt="Arena Background Pre-buffer"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
      />

      {/* Hardware-accelerated Video Element */}
      <video
        ref={videoRef}
        src="/laser_intro/intro.mp4"
        poster="/laser_intro/bg_last_frame.png"
        autoPlay
        playsInline
        preload="auto"
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleExit}
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
      />

      {/* Vignette Gradients matching arena ambience */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/75" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/50 via-transparent to-black/50" />
      <div className="absolute inset-0 pointer-events-none opacity-15 pixel-grid-bg" />

      {/* HUD Overlays (fade out slightly ahead of modal for cinematic reveal) */}
      <div
        className={`absolute inset-0 flex flex-col justify-between pointer-events-none transition-opacity duration-300 ${
          isExiting ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {/* HUD Top Bar */}
        <div className="p-4 sm:p-6 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-md border border-white/20 font-mono text-[11px] uppercase tracking-widest text-white shadow-xl">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-red-400 font-bold">REC</span>
              <span className="text-white/30">|</span>
              <span className="text-[#00D4FF] font-bold">DOTSLASH × GLITCH</span>
              <span className="hidden sm:inline text-[#A0A0A0]">// TACTICAL BRIEFING</span>
            </div>
          </div>

          {/* Sound Toggle & Skip */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleToggleSound}
              className="px-3.5 py-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 hover:border-[#00D4FF] text-white font-mono text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              {isMuted ? (
                <>
                  <VolumeX size={14} className="text-amber-400" />
                  <span className="text-amber-300 font-bold">Sound: OFF</span>
                </>
              ) : (
                <>
                  <Volume2 size={14} className="text-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 font-bold">Sound: ON</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExit}
              className="px-4 py-1.5 bg-[#3300FF] hover:bg-[#00D4FF] text-white hover:text-black font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(51,0,255,0.6)] cursor-pointer group"
            >
              <span>Skip Intro</span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              <span className="hidden md:inline text-[9px] opacity-70 ml-1">(ESC)</span>
            </button>
          </div>
        </div>

        {/* HUD Bottom Bar with Multi-Laser Neon Progress */}
        <div className="p-4 sm:p-6 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-auto">
          <div className="max-w-4xl mx-auto space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-white/80">
              <div className="flex items-center gap-2">
                <Crosshair size={13} className="text-[#00D4FF] animate-spin" />
                <span className="uppercase tracking-widest text-[#00D4FF] font-semibold">
                  Arena Synchronization Feed
                </span>
              </div>
              <span
                ref={timeTextRef}
                className="font-mono text-white tracking-widest font-semibold"
              >
                00:00 / 00:10
              </span>
            </div>

            {/* Multi-Laser Color Progress Track */}
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                ref={progressFillRef}
                className="h-full bg-gradient-to-r from-[#FF2A55] via-[#00E5FF] via-[#00FF66] to-[#FFB800] transition-all duration-75 shadow-[0_0_12px_rgba(0,229,255,0.9)]"
                style={{ width: '0%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
