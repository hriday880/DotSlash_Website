import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { fontsReady } from './textures';

// Canvas size and paper geometry share the same aspect ratio so the
// front page maps 1:1 onto the mesh without stretching.
const TEX_W = 512;
const TEX_H = 720;
const RES = 2; // canvas pixels per layout pixel, keeps small type crisp
export const PAPER_W = 0.62;
export const PAPER_H = PAPER_W * (TEX_H / TEX_W);
const PAPER_T = 0.014;
const LEAN = -0.16; // radians, leaning back against the shelf

function parseTags(tags) {
  try {
    const parsed = JSON.parse(tags || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Deterministic PRNG so the halftone pattern doesn't change between renders
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawFrontPage(ctx, blog, coverImg) {
  const M = 32;
  const inner = TEX_W - M * 2;
  const accent = blog.accent || '#3300FF';
  const rand = seeded(blog.slug || String(blog.id));

  // Newsprint
  ctx.fillStyle = '#FBFAF6';
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Accent band
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, TEX_W, 14);

  // Masthead
  ctx.fillStyle = '#01040B';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 38px Montserrat, sans-serif';
  ctx.fillText('DOTSLASH', TEX_W / 2, 66);
  ctx.font = '700 13px "Space Mono", monospace';
  ctx.fillStyle = '#3300FF';
  ctx.fillText('/.  M O N T H L Y', TEX_W / 2, 88);

  // Double rule + dateline
  ctx.fillStyle = '#01040B';
  ctx.fillRect(M, 102, inner, 3);
  ctx.fillRect(M, 108, inner, 1);
  ctx.font = '400 13px "Space Mono", monospace';
  ctx.fillStyle = '#4B5060';
  ctx.textAlign = 'left';
  ctx.fillText(`NO. ${String(blog.issue ?? blog.id).padStart(3, '0')}`, M, 128);
  ctx.textAlign = 'right';
  const date = new Date(blog.published_at);
  ctx.fillText(
    isNaN(date) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
    TEX_W - M,
    128
  );
  ctx.fillStyle = '#01040B';
  ctx.fillRect(M, 138, inner, 1);

  // Headline: shrink until it fits in 3 lines
  ctx.textAlign = 'left';
  ctx.fillStyle = '#01040B';
  let size = 44;
  let lines;
  do {
    ctx.font = `900 ${size}px Montserrat, sans-serif`;
    lines = wrapLines(ctx, (blog.title || '').toUpperCase(), inner);
    size -= 2;
  } while (lines.length > 3 && size > 22);
  const lineH = size * 1.08;
  let y = 150 + lineH;
  lines.slice(0, 3).forEach((l) => {
    ctx.fillText(l, M, y);
    y += lineH;
  });

  // Picture box
  const imgY = y - lineH + 22;
  const imgH = 220;
  if (coverImg) {
    const scale = Math.max(inner / coverImg.width, imgH / coverImg.height);
    const sw = inner / scale;
    const sh = imgH / scale;
    ctx.save();
    ctx.filter = 'grayscale(1) contrast(1.2)';
    ctx.drawImage(coverImg, (coverImg.width - sw) / 2, (coverImg.height - sh) / 2, sw, sh, M, imgY, inner, imgH);
    ctx.restore();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = accent;
    ctx.fillRect(M, imgY, inner, imgH);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(M, imgY, inner, imgH);
    // Halftone dots, denser toward a random focal point
    const fx = M + rand() * inner;
    const fy = imgY + rand() * imgH;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let gx = M + 6; gx < M + inner; gx += 12) {
      for (let gy = imgY + 6; gy < imgY + imgH; gy += 12) {
        const d = Math.hypot(gx - fx, gy - fy) / 260;
        const r = Math.max(0, 4.2 * (1 - d)) + rand() * 0.6;
        ctx.beginPath();
        ctx.arc(gx, gy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = '#01040B';
  ctx.lineWidth = 2;
  ctx.strokeRect(M, imgY, inner, imgH);

  // Tag stamp on the picture
  const tag = parseTags(blog.tags)[0];
  if (tag) {
    ctx.font = '700 13px "Space Mono", monospace';
    const tw = ctx.measureText(tag).width + 16;
    ctx.fillStyle = '#01040B';
    ctx.fillRect(M + 10, imgY + 10, tw, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(tag, M + 18, imgY + 27);
  }

  // Excerpt
  let ey = imgY + imgH + 30;
  ctx.fillStyle = '#1F2330';
  ctx.font = 'italic 17px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';
  wrapLines(ctx, blog.excerpt || '', inner).slice(0, 2).forEach((l) => {
    ctx.fillText(l, M, ey);
    ey += 22;
  });

  // Byline
  ctx.fillStyle = '#3300FF';
  ctx.font = '700 12px "Space Mono", monospace';
  ctx.fillText(`BY ${(blog.author || 'DOTSLASH').toUpperCase()}`, M, ey + 6);

  // Body copy columns (greeked)
  const colTop = ey + 22;
  const gap = 14;
  const colW = (inner - gap * 2) / 3;
  ctx.fillStyle = '#C9CBD3';
  for (let c = 0; c < 3; c++) {
    const x = M + c * (colW + gap);
    for (let ly = colTop; ly < TEX_H - 30; ly += 11) {
      const w = ly + 11 >= TEX_H - 30 ? colW * (0.3 + rand() * 0.4) : colW * (0.82 + rand() * 0.18);
      ctx.fillRect(x, ly, w, 5);
    }
    if (c > 0) {
      ctx.fillStyle = '#01040B';
      ctx.fillRect(x - gap / 2, colTop, 1, TEX_H - 30 - colTop);
      ctx.fillStyle = '#C9CBD3';
    }
  }
}

export default function Newspaper({ blog, position, onOpen, onHover, isHovered }) {
  const ref = useRef();
  const gl = useThree((s) => s.gl);
  const [coverImg, setCoverImg] = useState(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fontsReady.then(() => !cancelled && setFontsLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // front_image is a scan of the actual printed front page; cover_image is
  // just a photo dropped into the generated layout
  const imageSrc = blog.front_image || blog.cover_image;
  useEffect(() => {
    if (!imageSrc) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => !cancelled && setCoverImg(img);
    img.src = imageSrc;
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W * RES;
    canvas.height = TEX_H * RES;
    const ctx = canvas.getContext('2d');
    ctx.scale(RES, RES);
    if (blog.front_image && coverImg) {
      // Cover-fit the scan, anchored to the top so the headline stays visible
      const scale = Math.max(TEX_W / coverImg.width, TEX_H / coverImg.height);
      const sw = TEX_W / scale;
      const sh = TEX_H / scale;
      ctx.drawImage(coverImg, (coverImg.width - sw) / 2, 0, sw, sh, 0, 0, TEX_W, TEX_H);
    } else {
      drawFrontPage(ctx, blog, blog.front_image ? null : coverImg);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    return tex;
  }, [blog, coverImg, gl, fontsLoaded]);

  useEffect(() => () => texture.dispose(), [texture]);

  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: '#E6E2D8', roughness: 1 });
    const back = new THREE.MeshStandardMaterial({ color: '#F1EFE8', roughness: 1 });
    const front = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, envMapIntensity: 0.15 });
    // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back)
    return [edge, edge, edge, edge, front, back];
  }, [texture]);

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  // Pivot sits at the paper's bottom edge so leaning keeps it resting on the shelf
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const lift = isHovered ? 1 : 0;
    g.position.y = THREE.MathUtils.damp(g.position.y, position[1] + lift * 0.06, 10, delta);
    g.position.z = THREE.MathUtils.damp(g.position.z, position[2] + lift * 0.12, 10, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, LEAN + lift * 0.12, 10, delta);
  });

  return (
    <group ref={ref} position={position} rotation={[LEAN, 0, 0]}>
      <mesh
        position={[0, PAPER_H / 2, 0]}
        material={materials}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onOpen(blog.slug);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(blog);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = '';
        }}
      >
        <boxGeometry args={[PAPER_W, PAPER_H, PAPER_T]} />
      </mesh>
    </group>
  );
}
