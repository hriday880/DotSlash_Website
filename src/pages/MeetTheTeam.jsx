import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import Footer from '../components/Footer';

const teamData = {
  executive: [
    { name: "Hriday", role: "President", image: "/team/hriday.png" },
    { name: "Tejashwini", role: "Vice president", image: "/team/tejashwini.png" },
    { name: "Sadhya", role: "Secretary", image: "/team/sadhya.png" },
    { name: "Dhriti", role: "PR Head", image: "/team/dhriti.png" },
    { name: "Manan", role: "Treasurer", image: "/team/manan.png" },
  ],
  core: [
    { name: "Yashshree", role: "Co-head of Logistics", image: "/team/yashshree.png?v=2" },
    { name: "Anushaa", role: "Co-head of Logistics", image: "/team/anushaa.png?v=2" },
    { name: "Jane", role: "Social Media Head", image: "/team/jane_doe.jpeg" },
    { name: "Sia", role: "Content Head", image: "/team/sia.png?v=2" },
    { name: "Dev", role: "Coding Team Head", image: "/team/jane_doe.jpeg" },
    { name: "Jane", role: "Build Space Head", image: "/team/jane_doe.jpeg" },
    { name: "Aryan", role: "Outreach Head", image: "/team/jane_doe.jpeg" },
    { name: "Heena", role: "Design Head", image: "/team/jane_doe.jpeg" },
  ]
};

/* ASCII overlay that appears on hover over team photos */
const ASCII_CHARS = ' .:-+*=%@#';

function AsciiOverlay({ isHovered, containerRef }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!isHovered || !canvasRef.current || !containerRef.current) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = containerRef.current.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const cellW = 10;
    const cellH = 12;
    const cols = Math.floor(canvas.width / cellW);
    const rows = Math.floor(canvas.height / cellH);
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${cellH - 2}px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      time += 0.08;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * cellW + cellW / 2;
          const y = j * cellH + cellH / 2;

          const wave = Math.sin(i * 0.2 + time) * Math.cos(j * 0.15 + time * 0.7);
          const idx = Math.floor((wave + 1) * 0.5 * (ASCII_CHARS.length - 1));
          const char = ASCII_CHARS[Math.max(0, Math.min(idx, ASCII_CHARS.length - 1))];

          const t = (wave + 1) * 0.5;
          const r = Math.floor(51 * (1 - t));
          const g = Math.floor(212 * t);
          ctx.fillStyle = `rgba(${r}, ${g}, 255, ${0.4 + t * 0.4})`;
          ctx.fillText(char, x, y);
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isHovered, containerRef]);

  if (!isHovered) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none opacity-80 transition-opacity duration-300"
    />
  );
}

const TeamCard = ({ member, index }) => {
  const ref = useRef(null);
  const cardRef = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative overflow-hidden border border-[#1A1A1A] hover:border-[#3300FF] transition-all duration-300 w-full aspect-[3/4] cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref2={cardRef}
    >
      <div ref={cardRef} className="absolute inset-0 bg-[#0a0a0a]">
        {/* ASCII overlay in the background */}
        <AsciiOverlay isHovered={isHovered} containerRef={cardRef} />
        
        <img
          src={member.image}
          alt={member.name}
          className="relative z-10 w-full h-full object-cover filter grayscale contrast-125 group-hover:grayscale-0 group-hover:contrast-100 transition-all duration-700 scale-100 group-hover:scale-110"
        />
      </div>

      {/* Dark overlay that fades on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#030303]/90 via-[#030303]/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500 z-10" />

      {/* Name & Role reveal */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-20 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out">
        <h3 className="font-pixel text-sm text-[#3300FF] mb-1">{member.name}</h3>
        <p className="font-mono text-xs text-[#A0A0A0]">{member.role}</p>
      </div>
    </motion.div>
  );
};

export default function MeetTheTeam() {
  return (
    <div className="min-h-screen bg-[#030303] text-white pixel-grid-bg overflow-x-hidden pt-32 pb-0">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop relative z-10">
        <header className="mb-24 w-full md:w-8/12">
          <h1
            className="font-headline-display text-[40px] leading-[48px] sm:text-[60px] sm:leading-[70px] md:text-[80px] lg:text-headline-display lg:leading-[110px] text-[#3300FF] mb-8 uppercase break-words max-w-full glitch-text"
            data-text="The Family"
          >
            The Family
          </h1>
          <p className="font-body-lg text-body-lg text-[#c4c7c8] border-l border-[#1A1A1A] pl-8 max-w-2xl">
            An elite assembly of digital architects, creative engineers, and logical purists. We reject the mundane, building avant-garde systems that redefine technological sophistication.
          </p>
        </header>

        <div className="mb-24">
          <h2 className="font-pixel text-label-caps text-[#A0A0A0] mb-8 border-b border-[#1A1A1A] pb-2">
            01 / EXECUTIVE COMMITTEE
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-gutter">
            {teamData.executive.map((member, idx) => (
              <TeamCard key={`ec-${idx}`} member={member} index={idx} />
            ))}
          </div>
        </div>

        <div className="mb-24">
          <h2 className="font-pixel text-label-caps text-[#A0A0A0] mb-8 border-b border-[#1A1A1A] pb-2">
            02 / CORE COMMITTEES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-gutter">
            {teamData.core.map((member, idx) => (
              <TeamCard key={`cc-${idx}`} member={member} index={idx} />
            ))}
          </div>
        </div>

        {/* Hidden CC Members section */}
        <div className="hidden">
          <h2 className="font-pixel text-label-caps text-[#A0A0A0] mb-12 border-b border-[#1A1A1A] pb-2">03 / CC MEMBERS</h2>
          {["Logistics", "Social Media", "Content", "Coding Team", "Build Space", "Outreach"].map((dept, idx) => (
            <div key={idx} className="mb-16">
              <h3 className="font-pixel text-label-mono text-[#3300FF] mb-8 border-l border-[#3300FF] pl-4">{dept.toUpperCase()}</h3>
            </div>
          ))}
        </div>
      </div>

      <footer className="bg-[#030303] border-t border-[#1A1A1A] w-full grid grid-cols-12 gap-gutter px-margin-mobile md:px-margin-desktop py-8 md:py-section-gap relative z-20 mt-16">
        <div className="col-span-12 md:col-span-6 flex flex-col justify-between">
          <div className="font-headline-lg text-headline-lg font-black text-white mb-8">DOTSLASH</div>
          <p className="font-pixel text-label-mono text-[#636565]">
            © 2024 DOTSLASH. ALL RIGHTS RESERVED. ENGINEERED FOR EXCELLENCE.
          </p>
        </div>
        <div className="col-span-12 md:col-span-6 flex justify-end items-end gap-8">
        </div>
      </footer>
    </div>
  );
}
