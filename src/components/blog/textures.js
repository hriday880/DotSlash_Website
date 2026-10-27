import * as THREE from 'three';

// Canvas text silently falls back if a webfont isn't loaded yet, so make
// sure the exact faces used on the set are ready before drawing.
export const fontsReady =
  typeof document !== 'undefined' && document.fonts
    ? Promise.all(
        ['900 38px Montserrat', '700 13px "Space Mono"', '400 13px "Space Mono"'].map((f) =>
          document.fonts.load(f).catch(() => {})
        )
      )
    : Promise.resolve();

// Procedural canvas textures for the newsstand set. Everything is drawn
// locally so the scene has no network dependency.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(canvas, { repeat = [1, 1], srgb = true, rotate = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  if (rotate) {
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
  }
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Warm oak with long grain running along x
export function woodTexture({ base = '#B9824F', dark = '#7A4E2B', seed = 1, ...opts } = {}) {
  const [c, ctx] = canvas(512, 512);
  const rand = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    const y0 = rand() * 512;
    const amp = 2 + rand() * 6;
    const freq = 0.004 + rand() * 0.01;
    const phase = rand() * Math.PI * 2;
    ctx.strokeStyle = dark;
    ctx.globalAlpha = 0.04 + rand() * 0.12;
    ctx.lineWidth = 0.6 + rand() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // A couple of knots
  for (let k = 0; k < 2; k++) {
    const kx = rand() * 512;
    const ky = rand() * 512;
    for (let r = 14; r > 2; r -= 3) {
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r * 2.4, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  return finish(c, opts);
}

// Wide floor planks with staggered seams
export function floorTexture(opts = {}) {
  const [c, ctx] = canvas(1024, 1024);
  const rand = rng(7);
  const rows = 8;
  const rowH = 1024 / rows;
  const tones = ['#A8774C', '#9C6B42', '#B3825A', '#946440', '#A57348'];
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 400;
    while (x < 1024) {
      const len = 300 + rand() * 300;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.fillRect(x, r * rowH, len, rowH);
      // grain
      ctx.strokeStyle = '#5E3B20';
      for (let g = 0; g < 10; g++) {
        ctx.globalAlpha = 0.05 + rand() * 0.08;
        ctx.lineWidth = 1 + rand() * 1.5;
        const gy = r * rowH + rand() * rowH;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.bezierCurveTo(x + len * 0.3, gy + (rand() - 0.5) * 8, x + len * 0.7, gy + (rand() - 0.5) * 8, x + len, gy);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#3B2414';
      ctx.fillRect(x, r * rowH, 2, rowH);
      ctx.globalAlpha = 1;
      x += len;
    }
    ctx.fillStyle = '#3B2414';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, r * rowH, 1024, 3);
    ctx.globalAlpha = 1;
  }
  return finish(c, opts);
}

// Painted plaster with soft mottling
export function plasterTexture({ base = '#E8E3D8', ...opts } = {}) {
  const [c, ctx] = canvas(512, 512);
  const rand = rng(3);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 220; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    const shade = rand() > 0.5 ? '255,255,255' : '120,100,80';
    g.addColorStop(0, `rgba(${shade},0.05)`);
    g.addColorStop(1, `rgba(${shade},0)`);
    const x = rand() * 512;
    const y = rand() * 512;
    const s = 20 + rand() * 70;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(rand() * 512, rand() * 512, 1.5, 1.5);
  }
  return finish(c, opts);
}

// Vertical brand stripes for the awning canopy
export function stripeTexture(opts = {}) {
  const [c, ctx] = canvas(128, 16);
  ctx.fillStyle = '#3300FF';
  ctx.fillRect(0, 0, 64, 16);
  ctx.fillStyle = '#F6F7FB';
  ctx.fillRect(64, 0, 64, 16);
  return finish(c, opts);
}

// Scalloped valance with the masthead lettered on it (transparent below the
// scallops). Canvas width follows the mesh aspect so lettering isn't stretched.
export function valanceTexture(label, sub, aspect) {
  const H = 160;
  const W = Math.min(4096, Math.round(H * aspect));
  const [c, ctx] = canvas(W, H);
  const band = 100;
  const scallops = Math.max(4, Math.round(W / 130));
  const sw = W / scallops;
  ctx.fillStyle = '#3300FF';
  ctx.fillRect(0, 0, W, band);
  for (let i = 0; i < scallops; i++) {
    ctx.fillStyle = i % 2 ? '#F6F7FB' : '#3300FF';
    ctx.beginPath();
    ctx.moveTo(i * sw, band - 1);
    ctx.arc(i * sw + sw / 2, band - 1, sw / 2, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = '#01040B';
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const showSub = sub && W > 900;
  const room = W - (showSub ? 400 : 48);
  let size = 52;
  do {
    ctx.font = `900 ${size}px Montserrat, sans-serif`;
    size -= 2;
  } while (ctx.measureText(label).width > room && size > 18);
  ctx.fillText(label, W / 2, band / 2 + 2);
  if (showSub) {
    ctx.font = '700 18px "Space Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(sub, W - 28, band / 2 + 2);
    ctx.textAlign = 'left';
    ctx.fillText('/. NEWSSTAND', 28, band / 2 + 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
