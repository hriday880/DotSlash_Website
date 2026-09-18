import React, { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import Footer from '../components/Footer';
import { db } from '../lib/db';

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

const EventCard = ({ event, index }) => {
  const ref = useRef(null);
  const cardRef = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const isEven = index % 2 === 0;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group w-full mb-24`}>
      {/* Center dot for desktop timeline */}
      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#3300FF] z-20 items-center justify-center border-4 border-[#E4E4E7] shadow-[0_0_15px_rgba(51,0,255,0.8)] ">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
      </div>

      {/* Content Side */}
      <motion.div
        ref={ref}
        initial={{ opacity: 0, x: isEven ? -50 : 50 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: isEven ? -50 : 50 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`w-full md:w-[45%] ${isEven ? 'md:pr-12' : 'md:pl-12'} relative z-10`}
      >
        <div 
          className="glass-panel p-6 rounded-lg border border-black/5 hover:border-[#3300FF]/50 transition-all duration-300 cursor-pointer group/card"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <h3 className="font-sans tracking-widest uppercase font-semibold text-xl mb-2 text-[#030303] group-hover/card:text-[#3300FF] transition-colors">{event.title}</h3>
          <p className="font-sans text-xs tracking-widest uppercase font-semibold text-[#3300FF] mb-4 ">{event.date}</p>
          
          <div ref={cardRef} className="relative w-full h-48 mb-4 overflow-hidden rounded border border-[#E4E4E7] bg-[#F4F4F5]">
            <AsciiOverlay isHovered={isHovered} containerRef={cardRef} />
            <img 
              src={event.image} 
              alt={event.title}
              className="relative z-10 w-full h-full object-cover filter grayscale contrast-125 group-hover/card:grayscale-0 group-hover/card:contrast-100 transition-all duration-500 hover:scale-105"
            />
          </div>
          
          <p className="font-mono text-sm text-[#52525B] leading-relaxed">
            {event.description}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        if (!db) {
          setErrorMsg("No DB connection");
          return;
        }
        // Ensure table exists just in case they haven't visited Admin yet
        await db.execute(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT, date TEXT, image TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

        const res = await db.execute('SELECT * FROM events ORDER BY created_at DESC');
        let loadedEvents = res.rows || [];

        if (loadedEvents.length === 0) {
          const initialEvents = [
            {
              title: "DotSlash Mixer (DotSlash Arcade)",
              date: "September 4, 2026",
              image: "/events/mixer.png?v=1",
              description: "DotSlash FLAME's inaugural event of the academic year, bringing a futuristic arcade experience to campus at Learning Commons. Featuring student-built interactive games and installations including the DotSlash Mirror, Slash Runner, Pixel Art Guessing Game, Puzzle Camera, and a custom Sticker Claw Machine with tear-away arcade tickets and rewards. With over 70+ attendees and upbeat music, the event connected new students through an immersive celebration of creative technology."
            },
            {
              title: "Shuttle Shot",
              date: "November 3, 2025",
              image: "/events/shuttleshot.png?v=1",
              description: "In an exciting collaboration with the Astronomy Club, Shuttle Shot brings together the best of both worlds. An evening dedicated to exploring the cosmos through code, featuring interactive sessions, stargazing, and an immersive digital journey through our solar system. Participants engage in a unique blend of astronomy discussions and technology applications designed to inspire the next generation of space tech enthusiasts."
            },
            {
              title: "Tech AND Sport!",
              date: "September 12 & 13, 2025",
              image: "/events/techandsport.png?v=1",
              description: "A groundbreaking two-day event in partnership with the Squash Club. Bridging the physical and digital realms, this event features sports analytics, tracking technologies, and competitive squash matches. Discover how technology is revolutionizing sports training, performance tracking, and match analysis while breaking a sweat on the courts."
            },
            {
              title: "The Matrix Screening",
              date: "September 9, 2025",
              image: "/events/matrix.png?v=1",
              description: "Enter the Matrix with us for a special screening of the sci-fi classic. Followed by a deep dive discussion into the philosophical and technological themes of the movie. We'll explore concepts of simulated reality, artificial intelligence, and cybernetics, drawing parallels between the film's vision and our current technological trajectory."
            },
            {
              title: "DotSlash Jeopardy Night",
              date: "February 8, 2024",
              image: "/events/jeopardy.png?v=1",
              description: "A battle of wits and technical knowledge! Our custom-built Jeopardy platform tested participants on various categories spanning programming languages, tech history, pop culture, and computational logic. An evening of intense competition, laughter, and learning, with prizes for the ultimate trivia champions."
            },
            {
              title: "Code Along",
              date: "November 4, 2023",
              image: "/events/codealong.png?v=1",
              description: "An interactive coding workshop led by industry veteran Mr. Navneet Karnani. Participants built a full-stack application from scratch, learning modern development practices, debugging techniques, and deployment strategies. A hands-on experience bridging academic concepts with real-world software engineering."
            },
            {
              title: "Orabot",
              date: "October 6, 2023",
              image: "/events/orabot.png?v=1",
              description: "A unique public speaking and technology competition focusing on Large Language Models. Participants were challenged to craft persuasive speeches and arguments with the assistance of AI tools, then deliver them live. Exploring the intersection of human communication and artificial intelligence generation."
            },
            {
              title: "Apple Keynote event",
              date: "September 12, 2023",
              image: "/events/applekeynote.png?v=1",
              description: "Our annual tradition of watching the Apple Keynote together, enhanced with our custom-built Apple Bingo web application. Real-time excitement as we tracked product announcements, design reveals, and classic 'one more thing' moments, with the first to complete their digital bingo card winning exclusive tech swag."
            }
          ];

          for (const event of initialEvents.reverse()) {
            const uuid = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
            await db.execute(
              'INSERT INTO events (id, title, date, image, description) VALUES (?, ?, ?, ?, ?)',
              [uuid, event.title, event.date, event.image, event.description]
            );
          }
          const freshRes = await db.execute('SELECT * FROM events ORDER BY created_at DESC');
          loadedEvents = freshRes.rows || [];
        }

        setEvents(loadedEvents);
      } catch (err) {
        console.error("Failed to fetch events", err);
        setErrorMsg(err.message || String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#030303] overflow-x-hidden pt-32 pb-0">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop relative z-10">
        
        <div className="text-center mb-24">
          <h1 className="text-[40px] leading-[48px] sm:text-[60px] sm:leading-[70px] md:text-[80px] lg:text-[120px] lg:leading-[110px] font-sans tracking-widest uppercase font-semibold mb-6 text-[#3300FF] tracking-tighter uppercase">
            Timeline
          </h1>
          <p className="text-[#52525B] font-mono max-w-2xl mx-auto text-lg">
            FOMO no more. A chronological record of past operations, technological showcases, and competitive engagements.
          </p>
          {errorMsg && (
            <div className="mt-8 p-4 bg-red-100 text-red-600 font-mono text-xs text-left max-w-2xl mx-auto rounded border border-red-300">
              DEBUG ERROR: {errorMsg}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-32"><div className="w-12 h-12 border-4 border-[#3300FF] border-t-[#00D4FF] rounded-full animate-spin"></div></div>
        ) : events.length === 0 ? (
          <div className="text-center py-32 font-mono text-[#52525B]">No timeline events found. Add some from the Admin portal.</div>
        ) : (
          <div className="relative relative-timeline pb-24">
            {/* Vertical line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#3300FF] via-[#00D4FF] to-transparent md:-translate-x-1/2 opacity-30" />
            
            <div className="flex flex-col gap-8 md:gap-0 relative z-10">
              {events.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
