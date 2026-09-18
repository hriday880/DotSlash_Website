import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { db } from '../lib/db';
import AsciiScene from './Hero/AsciiScene';

export default function Announcement() {
  const [announcement, setAnnouncement] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        if (!db) return;
        const res = await db.execute('SELECT content FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1');
        if (res.rows && res.rows.length > 0) {
          const seen = sessionStorage.getItem('dotslash_seen_announcement');
          if (seen !== res.rows[0].content) {
            setAnnouncement(res.rows[0].content);
            setIsVisible(true);
          }
        }
      } catch (err) {
        console.error("Announcements Error:", err);
      }
    };
    fetchAnnouncement();
  }, []);

  const handleClose = () => {
    sessionStorage.setItem('dotslash_seen_announcement', announcement);
    setIsVisible(false);
  };

  if (!announcement) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#FFF8E7]"
        >
          {/* Background 3D ASCII Effect */}
          <div className="absolute inset-0 z-0 opacity-50">
            <AsciiScene />
          </div>

          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 max-w-3xl w-full p-8 md:p-12 text-center flex flex-col items-center pointer-events-auto"
          >
            <span className="flex items-center justify-center gap-3 font-mono text-xs text-[#3300FF] tracking-widest uppercase mb-8 font-bold">
              <span className="w-2 h-2 bg-[#3300FF] animate-pulse"></span>
              Global Broadcast
            </span>
            
            <p className="font-headline-display text-4xl sm:text-6xl text-[#3300FF] uppercase tracking-tighter mb-12 leading-none mix-blend-multiply">
              {announcement}
            </p>

            <button 
              onClick={handleClose}
              className="border border-[#3300FF] hover:bg-[#3300FF] text-[#3300FF] hover:text-white px-10 py-4 font-mono text-xs uppercase tracking-[0.2em] transition-all duration-300 font-bold"
            >
              Acknowledge
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
