import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Newspaper from './Newspaper';
import * as THREE from 'three';

export default function NewspaperRack({ blogs, activeSlug, onOpen, rotationTarget }) {
  const rackRef = useRef();
  
  // Design configuration based on the reference image
  const TIERS = 4;
  const ITEMS_PER_TIER = 4; // Hexagonal/Square layout
  const RADIUS = 1.6;
  const TIER_HEIGHT = 1.0;
  
  // Smoothly rotate the rack
  useFrame((state, delta) => {
    if (rackRef.current) {
      rackRef.current.rotation.y = THREE.MathUtils.damp(
        rackRef.current.rotation.y,
        rotationTarget,
        4,
        delta
      );
    }
  });

  const wireMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#a3a3a3',
    metalness: 0.8,
    roughness: 0.2,
    wireframe: false
  }), []);

  // Compute positions for newspapers
  const items = blogs.map((blog, idx) => {
    const tier = Math.floor(idx / ITEMS_PER_TIER);
    const posInTier = idx % ITEMS_PER_TIER;
    const angle = (posInTier * (Math.PI * 2)) / ITEMS_PER_TIER;
    
    // Position on the rack
    const x = Math.sin(angle) * RADIUS;
    const z = Math.cos(angle) * RADIUS;
    const y = -0.5 + (TIERS - 1 - tier) * TIER_HEIGHT; 
    
    return {
      blog,
      position: [x, y, z],
      rotation: [0, angle, 0], // face outward
    };
  });

  return (
    <group position={[0, -0.5, 0]}>
      {/* Rotatable Rack */}
      <group ref={rackRef}>
        
        {/* Central Pole */}
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.05, 0.05, 4, 16]} />
          <primitive object={wireMaterial} attach="material" />
        </mesh>
        
        {/* Cross Base */}
        <mesh position={[0, -0.45, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.4, 0.1, 32]} />
          <primitive object={wireMaterial} attach="material" />
        </mesh>
        <mesh position={[0, -0.4, 0]} rotation={[Math.PI/2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[2, 0.1, 0.05]} />
          <primitive object={wireMaterial} attach="material" />
        </mesh>
        <mesh position={[0, -0.4, 0]} rotation={[Math.PI/2, 0, Math.PI/2]} castShadow receiveShadow>
          <boxGeometry args={[2, 0.1, 0.05]} />
          <primitive object={wireMaterial} attach="material" />
        </mesh>

        {/* Tiers and Baskets */}
        {Array.from({ length: TIERS }).map((_, tierIdx) => (
          <group key={`tier-${tierIdx}`} position={[0, -0.5 + (TIERS - 1 - tierIdx) * TIER_HEIGHT, 0]}>
            {/* Inner Ring */}
            <mesh rotation={[Math.PI/2, 0, 0]}>
              <torusGeometry args={[RADIUS - 0.2, 0.02, 8, 32]} />
              <primitive object={wireMaterial} attach="material" />
            </mesh>
            
            {/* Basket wireframes for each slot */}
            {Array.from({ length: ITEMS_PER_TIER }).map((_, slotIdx) => {
              const angle = (slotIdx * (Math.PI * 2)) / ITEMS_PER_TIER;
              const x = Math.sin(angle) * (RADIUS - 0.1);
              const z = Math.cos(angle) * (RADIUS - 0.1);
              return (
                <group key={`basket-${slotIdx}`} position={[x, -0.15, z]} rotation={[0, angle, 0]}>
                  {/* Bottom rest */}
                  <mesh position={[0, -0.2, 0.1]}>
                    <boxGeometry args={[0.7, 0.02, 0.15]} />
                    <primitive object={wireMaterial} attach="material" />
                  </mesh>
                  {/* Front guard */}
                  <mesh position={[0, 0, 0.15]}>
                    <boxGeometry args={[0.7, 0.4, 0.02]} />
                    <meshStandardMaterial color="#c2c2c2" transparent opacity={0.3} />
                  </mesh>
                </group>
              );
            })}
          </group>
        ))}

        {/* Newspapers */}
        {items.map((item) => (
          <Newspaper 
            key={item.blog.slug} 
            blog={item.blog} 
            position={item.position}
            rotation={item.rotation}
            onClick={() => onOpen(item.blog.slug)}
            isActive={activeSlug === item.blog.slug}
          />
        ))}

      </group>
    </group>
  );
}
