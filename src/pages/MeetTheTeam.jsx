import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import Footer from '../components/Footer';

import { db } from '../lib/db';

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
  className="group relative overflow-hidden border border-[#E4E4E7] hover:border-[#3300FF] transition-all duration-300 w-full aspect-[3/4] cursor-pointer"
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
  ref2={cardRef}
 >
  <div ref={cardRef} className="absolute inset-0 bg-[#F4F4F5]">
  {/* ASCII overlay in the background */}
  <AsciiOverlay isHovered={isHovered} containerRef={cardRef} />
  
  <img
   src={member.image}
   alt={member.name}
   className="relative z-10 w-full h-full object-cover filter grayscale contrast-125 group-hover:grayscale-0 group-hover:contrast-100 transition-all duration-700 scale-100 group-hover:scale-110"
  />
  </div>

  {/* Dark overlay that fades on hover */}
  <div className="absolute inset-0 bg-gradient-to-t from-[#FFFFFF]/90 via-[#FFFFFF]/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500 z-10" />

  {/* Name & Role reveal */}
  <div className="absolute bottom-0 left-0 right-0 p-6 z-20 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out">
  <h3 className="font-sans text-xs tracking-widest uppercase font-semibold text-sm text-[#3300FF] mb-1">{member.name}</h3>
  <p className="font-mono text-xs text-[#52525B]">{member.role}</p>
  </div>
 </motion.div>
 );
};

export default function MeetTheTeam() {
  const [teamData, setTeamData] = useState({ executive: [], departments: {} });

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        if (!db) return;
        
        // Ensure table exists
        await db.execute(`CREATE TABLE IF NOT EXISTS personnel (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, department TEXT, image TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

        const res = await db.execute('SELECT * FROM personnel ORDER BY created_at ASC');
        let loadedPersonnel = res.rows || [];

        if (loadedPersonnel.length === 0) {
          const initialPersonnel = [
            { name: "Hriday", role: "President", department: "executive", image: "/team/hriday.png" },
            { name: "Tejashwini", role: "Vice president", department: "executive", image: "/team/tejashwini.png" },
            { name: "Sadhya", role: "Secretary", department: "executive", image: "/team/sadhya.png" },
            { name: "Dhriti", role: "PR Head", department: "executive", image: "/team/dhriti.png" },
            { name: "Manan", role: "Treasurer", department: "executive", image: "/team/manan.png" },
            
            { name: "Yashshree", role: "Co-head of Logistics", department: "logistics", image: "/team/yashshree.png?v=2" },
            { name: "Anushaa", role: "Co-head of Logistics", department: "logistics", image: "/team/anushaa.png?v=2" },
            { name: "Jane", role: "Social Media Head", department: "social_media", image: "/team/jane_doe.jpeg" },
            { name: "Sia", role: "Content Head", department: "content", image: "/team/sia.png?v=2" },
            { name: "Dev", role: "Coding Team Head", department: "coding_robotics", image: "/team/jane_doe.jpeg" },
            { name: "Jane", role: "Build Space Head", department: "coding_robotics", image: "/team/jane_doe.jpeg" },
            { name: "Aryan", role: "Outreach Head", department: "outreach", image: "/team/jane_doe.jpeg" },
            { name: "Heena", role: "Design Head", department: "design", image: "/team/jane_doe.jpeg" },
          ];

          for (const member of initialPersonnel) {
            const uuid = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
            await db.execute(
              'INSERT INTO personnel (id, name, role, department, image) VALUES (?, ?, ?, ?, ?)',
              [uuid, member.name, member.role, member.department, member.image]
            );
          }
          const freshRes = await db.execute('SELECT * FROM personnel ORDER BY created_at ASC');
          loadedPersonnel = freshRes.rows || [];
        }

        const exec = loadedPersonnel.filter(m => m.department === 'executive');
        const depts = {};
        
        loadedPersonnel.forEach(m => {
          if (m.department !== 'executive') {
            if (!depts[m.department]) depts[m.department] = [];
            depts[m.department].push(m);
          }
        });
        
        setTeamData({ executive: exec, departments: depts });
      } catch (e) {
        console.error("DB Fetch Error:", e);
      }
    };
    fetchTeam();
  }, []);

 return (
 <div className="min-h-screen bg-[#F3F4F6] text-[#030303] overflow-x-hidden pt-32 pb-0">
  <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop relative z-10">
  <header className="mb-24 w-full md:w-8/12">
   <h1
   className="font-headline-display text-[40px] leading-[48px] sm:text-[60px] sm:leading-[70px] md:text-[80px] lg:text-headline-display lg:leading-[110px] text-[#3300FF] mb-8 uppercase break-words max-w-full "
   
   >
   The Family
   </h1>
   <p className="font-body-lg text-body-lg text-[#52525B] border-l border-[#E4E4E7] pl-8 max-w-2xl">
   An elite assembly of digital architects, creative engineers, and logical purists. We reject the mundane, building avant-garde systems that redefine technological sophistication.
   </p>
  </header>

  <div className="mb-24">
   <h2 className="font-sans text-xs tracking-widest uppercase font-semibold text-label-caps text-[#52525B] mb-8 border-b border-[#E4E4E7] pb-2">
   01 / EXECUTIVE COMMITTEE
   </h2>
   <div className="grid grid-cols-1 md:grid-cols-5 gap-gutter">
   {teamData.executive.map((member, idx) => (
    <TeamCard key={`ec-${idx}`} member={member} index={idx} />
   ))}
   </div>
  </div>

  <div className="mb-24">
    <h2 className="font-sans text-xs tracking-widest uppercase font-semibold text-label-caps text-[#52525B] mb-8 border-b border-[#E4E4E7] pb-2">
    02 / DEPARTMENTS
    </h2>
    
    {Object.keys(teamData.departments).length === 0 && (
      <p className="text-[#A0A0A0] italic">No department members found.</p>
    )}

    {Object.entries(teamData.departments).map(([deptKey, members]) => (
      <div key={deptKey} className="mb-16">
        <h3 className="font-sans text-xs tracking-widest uppercase font-semibold text-label-mono text-[#3300FF] mb-8 border-l-2 border-[#3300FF] pl-4">
          {deptKey.replace('_', ' ')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-gutter">
          {members.map((member, idx) => (
            <TeamCard key={`${deptKey}-${idx}`} member={member} index={idx} />
          ))}
        </div>
      </div>
    ))}
  </div>
  </div>

  <footer className="bg-[#F3F4F6] border-t border-[#E4E4E7] w-full grid grid-cols-12 gap-gutter px-margin-mobile md:px-margin-desktop py-8 md:py-section-gap relative z-20 mt-16">
  <div className="col-span-12 md:col-span-6 flex flex-col justify-between">
   <div className="font-headline-lg text-headline-lg font-black text-[#030303] mb-8">DotSlash</div>
   <p className="font-sans text-xs tracking-widest uppercase font-semibold text-label-mono text-[#636565]">
   © 2024 DotSlash. ALL RIGHTS RESERVED. ENGINEERED FOR EXCELLENCE.
   </p>
  </div>
  <div className="col-span-12 md:col-span-6 flex justify-end items-end gap-8">
  </div>
  </footer>
 </div>
 );
}
