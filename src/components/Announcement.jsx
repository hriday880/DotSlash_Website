import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { db } from '../lib/db';
import InkAirplane from './Hero/InkAirplane';
import AsciiScene from './Hero/AsciiScene';

export default function Announcement() {
  const location = useLocation();
  const [announcement, setAnnouncement] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const isLaserTag = location.pathname.startsWith('/laser-tag') || location.pathname.startsWith('/lasertag');
  const isHome = location.pathname === '/';

  useEffect(() => {
    if (!isHome && !isLaserTag) return;

    const fetchAnnouncement = async () => {
      try {
        if (!db) return;
        const res = await db.execute('SELECT content FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1');
        if (res.rows && res.rows.length > 0) {
          const content = res.rows[0].content;
          const storageKey = isLaserTag ? 'dotslash_seen_announcement_lasertag' : 'dotslash_seen_announcement';
          const seen = sessionStorage.getItem(storageKey);

          // Check if landed via QR scan / promotional link
          const search = new URLSearchParams(window.location.search);
          const hasQrParam = search.has('qr') || search.has('from') || search.has('src') || search.has('source') || search.has('scan');

          if (hasQrParam || seen !== content) {
            setAnnouncement(content);
            setIsVisible(true);
          }
        }
      } catch (err) {
        console.error("Announcements Error:", err);
      }
    };
    fetchAnnouncement();
  }, [isLaserTag, isHome, location.pathname, location.search]);

  const handleClose = () => {
    const storageKey = isLaserTag ? 'dotslash_seen_announcement_lasertag' : 'dotslash_seen_announcement';
    sessionStorage.setItem(storageKey, announcement);
    sessionStorage.setItem('dotslash_seen_announcement', announcement);
    setIsVisible(false);
  };

  if ((!isHome && !isLaserTag) || !announcement) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#FFF8E7]"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 z-0 opacity-100"
          >
            {/* The interactive ASCII background */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply">
              <AsciiScene />
            </div>

            {/* The 3D Paper Airplane vortex */}
            <InkAirplane 
              title={announcement}
              topText={isLaserTag ? "Tactical Broadcast" : "Global Broadcast"}
            />
          </motion.div>

          <button 
            onClick={handleClose}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 border border-[#3300FF] hover:bg-[#3300FF] text-[#3300FF] hover:text-white px-10 py-4 font-mono text-xs uppercase tracking-[0.2em] transition-all duration-300 font-bold z-50 bg-[#FFF8E7]"
          >
            {isLaserTag ? "Proceed to Arena" : "Acknowledge"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
