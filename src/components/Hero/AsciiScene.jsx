import { useRef, useEffect } from 'react';

const ASCII_CHARS = ' .:-+*=%@#';
const CELL_WIDTH = 14;
const CELL_HEIGHT = 16;

export default function AsciiScene({ className = '' }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let offsetX = 0;
    let offsetY = 0;
    let dpr = 1;

    const handleResize = () => {
      const parent = canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
      
      width = rect.width || window.innerWidth;
      height = rect.height || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      cols = Math.floor(width / CELL_WIDTH);
      rows = Math.floor(height / CELL_HEIGHT);
      offsetX = (width - cols * CELL_WIDTH) / 2;
      offsetY = (height - rows * CELL_HEIGHT) / 2;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        mouseRef.current.targetX = (e.clientX - rect.left) / rect.width;
        mouseRef.current.targetY = (e.clientY - rect.top) / rect.height;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          mouseRef.current.targetX = (touch.clientX - rect.left) / rect.width;
          mouseRef.current.targetY = (touch.clientY - rect.top) / rect.height;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    let startTime = performance.now();

    const render = (now) => {
      const elapsed = (now - startTime) * 0.001;

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      ctx.font = '12px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const numChars = ASCII_CHARS.length;

      for (let r = 0; r < rows; r++) {
        const ny = r / rows;
        const cy = offsetY + r * CELL_HEIGHT + CELL_HEIGHT / 2;

        for (let c = 0; c < cols; c++) {
          const nx = c / cols;
          const cx = offsetX + c * CELL_WIDTH + CELL_WIDTH / 2;

          // 3D Particle Wave styled harmonic frequencies
          const w1 = Math.sin(nx * 7.0 + elapsed * 1.6 + ny * 3.5);
          const w2 = Math.cos(ny * 8.5 - elapsed * 1.2 + nx * 4.0);
          const w3 = Math.sin((nx + ny) * 5.0 + elapsed * 0.9);

          // Mouse perturbation ripple
          const dx = (nx - mx) * (width / height);
          const dy = ny - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const mouseRipple = Math.sin(dist * 16.0 - elapsed * 3.5) * Math.exp(-dist * 4.0) * 1.1;

          // Combine wave heights
          const elevation = (w1 * 0.35 + w2 * 0.35 + w3 * 0.3 + mouseRipple);
          
          // Depth factor for 3D horizon feel
          const depth = 0.4 + 0.6 * ny;
          const normalizedVal = Math.max(0, Math.min(1, (elevation * depth + 1.0) / 2.0));

          const charIdx = Math.floor(normalizedVal * (numChars - 1));
          const char = ASCII_CHARS[charIdx];

          // Skip rendering spaces
          if (char === ' ' || !char) continue;

          // Color gradient: #3300FF (rgb: 51, 0, 255) -> #00D4FF (rgb: 0, 212, 255)
          const red = Math.round(51 * (1 - normalizedVal));
          const green = Math.round(212 * normalizedVal);
          const blue = 255;
          const alpha = (0.25 + normalizedVal * 0.75).toFixed(2);

          ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
          ctx.fillText(char, cx, cy);
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      aria-hidden="true"
    />
  );
}
