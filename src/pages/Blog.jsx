import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Footer from '../components/Footer';

const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>';

export default function Blog() {
  const [text, setText] = useState('');
  const targetText = 'TRANSMISSION INCOMING';
  
  // Scramble text effect
  useEffect(() => {
    let iteration = 0;
    let interval = null;
    
    // Start delay
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        setText(
          targetText
            .split('')
            .map((letter, index) => {
              if (index < iteration) {
                return targetText[index];
              }
              return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
            })
            .join('')
        );

        if (iteration >= targetText.length) {
          clearInterval(interval);
        }
        
        iteration += 1 / 3; // speed of deciphering
      }, 30);
    }, 500);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-[#FFFFFF] overflow-hidden pt-32 pb-0 flex flex-col relative font-sans">
      
      {/* Background Animated Grid */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#3300FF1a_1px,transparent_1px),linear-gradient(to_bottom,#3300FF1a_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <motion.div 
          animate={{ 
            y: [0, 40, 0],
            opacity: [0.3, 0.6, 0.3] 
          }}
          transition={{ 
            duration: 5, 
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,#3300FF_10%,transparent_20%)] bg-[length:100%_200%]"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="relative"
        >
          {/* Glowing Accents */}
          <div className="absolute -inset-10 bg-[#3300FF] opacity-10 blur-3xl rounded-full"></div>
          
          <div className="border border-[#353535] bg-[#0a0a0a]/80 backdrop-blur-sm p-12 md:p-24 relative group overflow-hidden">
            {/* Top left corner accent */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#3300FF]"></div>
            {/* Bottom right corner accent */}
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00D4FF]"></div>
            
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex items-center gap-4">
                <span className="w-3 h-3 bg-[#FF3366] rounded-full animate-ping"></span>
                <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#A0A0A0]">System Status: Standby</span>
              </div>
              
              <h1 className="font-headline-display text-4xl sm:text-6xl md:text-8xl text-transparent bg-clip-text bg-gradient-to-r from-[#3300FF] to-[#00D4FF] uppercase tracking-tighter filter drop-shadow-[0_0_15px_rgba(51,0,255,0.5)]">
                Coming Soon
              </h1>
              
              <div className="h-8 flex items-center justify-center">
                <p className="font-mono text-sm sm:text-lg text-[#00D4FF] tracking-[0.2em] md:tracking-[0.5em] uppercase w-full">
                  {text}
                </p>
              </div>
            </div>

            {/* Scanning line effect */}
            <motion.div 
              animate={{ top: ['0%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[1px] bg-[#3300FF]/50 shadow-[0_0_10px_#3300FF] z-20"
            />
          </div>
        </motion.div>
        
      </div>
    </div>
  );
}
