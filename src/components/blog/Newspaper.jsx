import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export default function Newspaper({ blog, position, rotation, onClick, isActive }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Generate the CanvasTexture dynamically
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Background paper
    ctx.fillStyle = '#FCFCFD';
    ctx.fillRect(0, 0, 768, 512);

    // Header line
    ctx.fillStyle = '#3300FF';
    ctx.fillRect(0, 0, 768, 20);

    // Masthead
    ctx.fillStyle = '#01040B';
    ctx.font = 'bold 32px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('/. DOTSLASH MONTHLY', 384, 60);

    // Line
    ctx.beginPath();
    ctx.moveTo(40, 80);
    ctx.lineTo(728, 80);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#717784';
    ctx.stroke();
    ctx.setLineDash([]);

    // Date / Tag
    ctx.font = '16px "Space Mono", monospace';
    ctx.fillStyle = '#717784';
    ctx.textAlign = 'left';
    ctx.fillText(new Date(blog.published_at).toLocaleDateString(), 40, 110);

    if (blog.tags) {
      try {
        const tags = JSON.parse(blog.tags);
        ctx.fillStyle = '#3300FF';
        ctx.textAlign = 'right';
        ctx.fillText(tags[0] || 'ARCHIVE', 728, 110);
      } catch (e) {}
    }

    // Title (wrapped)
    ctx.fillStyle = '#01040B';
    ctx.font = 'bold 36px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    const words = blog.title.toUpperCase().split(' ');
    let line = '';
    let y = 170;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 680 && i > 0) {
        ctx.fillText(line, 384, y);
        line = words[i] + ' ';
        y += 45;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 384, y);

    // Image placeholder / halftone area
    const imgY = y + 30;
    ctx.fillStyle = blog.accent || '#EBEDF5';
    ctx.fillRect(40, imgY, 688, 180);
    
    // ASCII/Halftone mock pattern
    ctx.fillStyle = '#01040B';
    ctx.globalAlpha = 0.3;
    for (let i=0; i<400; i++) {
      const px = 40 + Math.random() * 688;
      const py = imgY + Math.random() * 180;
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1.0;

    // Lorem column
    ctx.fillStyle = '#717784';
    let textY = imgY + 200;
    for (let i=0; i<4; i++) {
      ctx.fillRect(40, textY, 688, 8);
      textY += 16;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [blog]);

  // Target values for animation
  const targetPos = new THREE.Vector3(...position);
  const targetRot = new THREE.Euler(...rotation);
  
  if (hovered && !isActive) {
    // Nudge out slightly when hovered
    const offset = new THREE.Vector3(0, 0.1, 0.1).applyEuler(targetRot);
    targetPos.add(offset);
    targetRot.x -= 0.1; // tilt back slightly
  }

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    if (isActive) {
      // Fly out to camera
      // The camera is at [0, 1.5, 6]. We want the paper to come close to it.
      // But the rack itself is rotating, which makes global positioning tricky.
      // We will handle reader overlay in the DOM. 
      // The mesh will just fade out or stay still, because DOM overlay covers the screen.
      // So no complex flyout in 3D needed if DOM overlay covers it perfectly.
      // We will just scale it down slightly.
      meshRef.current.scale.lerp(new THREE.Vector3(0.9, 0.9, 0.9), 0.1);
    } else {
      // Normal state / Hover
      meshRef.current.position.lerp(targetPos, 0.1);
      
      const currentRot = new THREE.Quaternion().setFromEuler(meshRef.current.rotation);
      const targetQuat = new THREE.Quaternion().setFromEuler(targetRot);
      currentRot.slerp(targetQuat, 0.1);
      meshRef.current.rotation.setFromQuaternion(currentRot);

      meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        castShadow
        receiveShadow
      >
        <planeGeometry args={[0.9, 0.6, 4, 4]} />
        <meshStandardMaterial 
          map={texture} 
          side={THREE.DoubleSide} 
          roughness={0.9} 
          metalness={0.1}
          emissive={hovered ? "#36AEFC" : "#000000"}
          emissiveIntensity={hovered ? 0.2 : 0}
        />
        
        {/* Tooltip on hover */}
        {hovered && !isActive && (
          <Html position={[0, 0.5, 0.05]} center>
            <div className="bg-[#00123B] text-white text-xs font-mono px-3 py-1 whitespace-nowrap shadow-xl">
              {blog.title}
            </div>
          </Html>
        )}
      </mesh>
    </group>
  );
}
