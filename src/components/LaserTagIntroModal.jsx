import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, ArrowRight, Crosshair, Play, AlertCircle } from 'lucide-react';

export default function LaserTagIntroModal({ isOpen, onClose }) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [hasError, setHasError] = useState(false);

  const videoRef = useRef(null);
  const progressFillRef = useRef(null);
  const timeTextRef = useRef(null);

  // Immediately close modal and enter arena — zero timers, zero race conditions
  const handleExit = (e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // Ignore
      }
    }

    if (onClose) {
      onClose();
    }
  };

  // Keyboard shortcut: ESC to skip
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleExit(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Guaranteed Playback Attempt on Mount / Open
  useEffect(() => {
    if (!isOpen) return;

    setHasError(false);
    setIsBuffering(false);

    const tryPlay = async () => {
      if (!videoRef.current) return;
      try {
        videoRef.current.currentTime = 0;
        await videoRef.current.play();
        setIsPlaying(true);
        setIsAutoplayBlocked(false);
      } catch (err) {
        console.warn('Autoplay restricted by browser, user gesture required:', err);
        setIsAutoplayBlocked(true);
        setIsPlaying(false);
      }
    };

    const timer = setTimeout(tryPlay, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

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

  const handleManualPlay = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (hasError) {
      handleExit(e);
      return;
    }
    if (!videoRef.current) return;

    try {
      if (videoRef.current.paused) {
        await videoRef.current.play();
        setIsPlaying(true);
        setIsAutoplayBlocked(false);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Play request failed:', err);
    }
  };

  const handleToggleSound = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);

    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setIsAutoplayBlocked(false);
    }
  };

  if (!isOpen) return null;

  const videoSrc =
    typeof window !== 'undefined' && window.innerWidth <= 640
      ? '/laser_intro/intro_540p.mp4'
      : '/laser_intro/intro.mp4';

  return (
    <div
      onClick={handleManualPlay}
      className="fixed inset-0 z-[100] bg-[#050608] flex items-center justify-center overflow-hidden select-none cursor-pointer"
    >
      {/* 1. Underlying static ambient backdrop */}
      <img
        src="/laser_intro/bg_last_frame.jpg"
        alt="Arena Ambience"
        className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-105 pointer-events-none"
      />

      {/* 2. Responsive Video Container */}
      <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
        <video
          ref={videoRef}
          src={videoSrc}
          poster="/laser_intro/bg_last_frame.jpg"
          playsInline
          webkit-playsinline="true"
          preload="auto"
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleExit}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
            setHasError(false);
          }}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            console.warn('Video failed to load');
            setHasError(true);
          }}
          className="w-full h-auto max-h-[70vh] sm:max-h-[85vh] md:max-h-full md:h-full md:w-full object-contain md:object-cover mx-auto my-auto z-10 transition-transform duration-300 pointer-events-auto"
        />

        {/* Ambient Dark Scrim */}
        <div className="absolute inset-0 pointer-events-none bg-black/30" />
      </div>

      {/* 3. Center Interactive Overlay (Play Button / Buffering Radar / Error) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
        {(!isPlaying || isAutoplayBlocked) && !isBuffering && !hasError && (
          <button
            type="button"
            onClick={handleManualPlay}
            className="pointer-events-auto px-6 py-3.5 bg-black/75 hover:bg-[#00D4FF] hover:text-black border-2 border-[#00D4FF] text-white font-mono text-xs sm:text-sm font-extrabold uppercase tracking-widest flex items-center gap-3 backdrop-blur-xl shadow-[0_0_35px_rgba(0,212,255,0.4)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Play size={18} className="fill-current text-[#00D4FF] group-hover:text-black" />
            <span>Tap to Play Briefing</span>
          </button>
        )}

        {isBuffering && !hasError && (
          <div className="px-5 py-3 bg-black/80 border border-[#00D4FF]/60 backdrop-blur-xl font-mono text-xs text-[#00D4FF] flex items-center gap-3 shadow-[0_0_25px_rgba(0,212,255,0.3)]">
            <Crosshair size={18} className="animate-spin text-[#00D4FF]" />
            <span className="tracking-wider uppercase font-bold">Buffering Arena Feed...</span>
          </div>
        )}

        {hasError && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto p-6 bg-black/85 border border-red-500/60 backdrop-blur-2xl text-center space-y-3 max-w-sm mx-4"
          >
            <div className="flex items-center justify-center gap-2 text-red-400 font-mono text-xs uppercase font-bold">
              <AlertCircle size={16} />
              <span>Briefing Stream Offline</span>
            </div>
            <p className="text-white/70 text-xs font-mono">
              Unable to stream video feed. You can proceed directly to the registration arena.
            </p>
            <button
              type="button"
              onClick={handleExit}
              className="w-full py-2.5 px-4 bg-[#00D4FF] hover:bg-white text-black font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Enter Arena Directly
            </button>
          </div>
        )}
      </div>

      {/* 4. HUD Overlays (Top Bar & Bottom Progress Bar) */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-40">
        <div className="p-3 sm:p-5 md:p-6 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent">
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 sm:px-3.5 bg-black/65 backdrop-blur-xl border border-white/15 font-mono text-[10px] sm:text-xs uppercase tracking-widest text-white">
            <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-ping" />
            <span className="font-bold text-[#00D4FF]">MISSION BRIEFING</span>
            <span className="text-white/40 hidden xs:inline">//</span>
            <span className="text-white/80 hidden xs:inline">4V4 ARENA</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
            <button
              type="button"
              onClick={handleToggleSound}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 bg-black/70 hover:bg-black/90 backdrop-blur-xl border font-mono text-[11px] sm:text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                isMuted
                  ? 'border-amber-400/50 text-amber-300 hover:border-amber-400'
                  : 'border-emerald-400/50 text-emerald-300 hover:border-emerald-400'
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX size={14} className="text-amber-400" />
                  <span className="text-amber-300 font-bold hidden sm:inline">Sound: OFF</span>
                </>
              ) : (
                <>
                  <Volume2 size={14} className="text-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 font-bold hidden sm:inline">Sound: ON</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExit}
              className="px-4 py-1.5 sm:px-5 sm:py-2 bg-[#00D4FF] hover:bg-white text-black font-mono text-[11px] sm:text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_20px_rgba(0,212,255,0.45)] cursor-pointer group"
            >
              <span>Skip</span>
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              <span className="hidden md:inline text-[10px] opacity-75 ml-0.5">(ESC)</span>
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-5 md:p-6 bg-black/70 backdrop-blur-xl border-t border-white/15 pointer-events-auto pb-6 sm:pb-5">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono text-white/80">
              <div className="flex items-center gap-2">
                <Crosshair size={13} className="text-[#00D4FF]" />
                <span className="uppercase tracking-wider text-[#00D4FF] font-semibold text-[10px] sm:text-xs">
                  Tactical Synchronization
                </span>
              </div>
              <span
                ref={timeTextRef}
                className="font-mono text-white tracking-widest font-semibold text-xs sm:text-sm"
              >
                00:00 / 00:10
              </span>
            </div>

            <div className="w-full h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden border border-white/10">
              <div
                ref={progressFillRef}
                className="h-full bg-[#00D4FF] transition-all duration-75 shadow-[0_0_10px_#00D4FF]"
                style={{ width: '0%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
