import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

const ASCIIBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let time = 0;
    
    const chars = ' .:-+*=%@#'.split('');
    const charSize = 14;
    
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    let cols = Math.floor(width / charSize);
    let rows = Math.floor(height / charSize);
    
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      cols = Math.floor(width / charSize);
      rows = Math.floor(height / charSize);
    };
    
    window.addEventListener('resize', handleResize);
    
    let mouse = { x: width / 2, y: height / 2 };
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.fillStyle = '#030303';
      ctx.fillRect(0, 0, width, height);
      
      ctx.font = `${charSize}px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      time += 0.05;
      
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * charSize + charSize / 2;
          const y = j * charSize + charSize / 2;
          
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 300;
          const influence = Math.max(0, 1 - dist / maxDist);
          
          const wave = Math.sin(i * 0.1 + time) + Math.cos(j * 0.1 + time);
          const modifiedWave = wave + influence * 2;
          
          const charIndex = Math.floor(Math.abs(modifiedWave) * (chars.length / 2)) % chars.length;
          const char = chars[charIndex];
          
          // Gradient colors from #3300FF to #00D4FF
          // #3300FF = 51, 0, 255
          // #00D4FF = 0, 212, 255
          const r = Math.floor(51 - influence * 51);
          const g = Math.floor(0 + influence * 212);
          const b = 255;
          
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillText(char, x, y);
        }
      }
      
      animationFrameId = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />;
};

/* ASCII overlay that appears on hover over images */
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

import { useState } from 'react';

const Hero = () => {
  const containerRef = useRef(null);
  const imageContainerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  
  useEffect(() => {
    // Simple GSAP animation
    const ctx = gsap.context(() => {
      gsap.from(".hero-text", {
        y: 50,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out"
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="w-full bg-[#030303] text-white">
      {/* 1. Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <ASCIIBackground />
        <div className="z-10 text-center mix-blend-difference pointer-events-none">
          <h1 className="hero-text text-[10vw] md:text-9xl font-headline-display font-bold leading-none tracking-tighter mix-blend-difference text-white">
            DOTSLASH
          </h1>
          <p className="hero-text font-pixel text-[#00D4FF] mt-4 text-sm md:text-base tracking-widest uppercase">
            ELITE TECH / ARCHITECTING THE VOID
          </p>
        </div>
      </section>

      {/* 2. BUILD SPACE Section */}
      <section className="pixel-grid-bg relative py-24 px-6 md:px-12 lg:px-24 border-t border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-pixel text-[#3300FF] text-2xl md:text-4xl mb-6">Build Space</h2>
            <p className="font-mono text-[#A0A0A0] text-lg mb-8 leading-relaxed">
              We don't just write code; we forge digital architecture. Scalable, performant, and uncompromising.
            </p>
            <button className="pixel-border-cyan text-[#00D4FF] hover:bg-[#00D4FF] hover:text-[#030303] transition-colors duration-300 px-6 py-3 font-pixel text-sm uppercase">
              Explore Hardware
            </button>
          </div>
          <div 
            ref={imageContainerRef}
            className="relative aspect-square md:aspect-video border border-[#3300FF] p-2 bg-[#0a0a0a] overflow-hidden cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <AsciiOverlay isHovered={isHovered} containerRef={imageContainerRef} />
            <img 
              src="https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80" 
              alt="Build Space" 
              className="relative z-10 w-full h-full object-cover opacity-80 mix-blend-luminosity grayscale hover:grayscale-0 transition-all duration-500 hover:scale-105"
            />
          </div>
        </div>
      </section>

      {/* 3. DIVISIONS Section */}
      <section className="py-24 px-6 md:px-12 lg:px-24 bg-[#131313]">
        <div className="max-w-7xl mx-auto">
          <p className="font-pixel text-[#00D4FF] mb-12">// DIVISIONS</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="glass-panel pixel-border p-8 bg-[#0D1B3E]/30">
              <h3 className="font-mono text-xl text-white mb-4">Software Division</h3>
              <p className="font-body-md text-[#A0A0A0]">Scalable, uncompromising application architecture.</p>
            </div>
            <div className="glass-panel pixel-border p-8 bg-[#0D1B3E]/30">
              <h3 className="font-mono text-xl text-white mb-4">Algorithmic Division</h3>
              <p className="font-body-md text-[#A0A0A0]">Data modeling and low-latency processing pipelines.</p>
            </div>
          </div>
          
          <div className="text-center">
            <h2 className="font-headline-md text-4xl md:text-6xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#3300FF] to-[#00D4FF] uppercase tracking-tighter">
              Precision Engineered Execution
            </h2>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Hero;
