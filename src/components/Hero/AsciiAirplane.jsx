import React, { useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AsciiRenderer, useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

function Airplane({ offset, radius, speed, heightOffset }) {
  const { scene } = useGLTF('/paper_airplane.glb');
  const clone = useMemo(() => scene.clone(), [scene]);
  const group = useRef();

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // Circular orbit logic
    const angle = (time * speed) + offset;
    
    // Position in a circle
    group.current.position.x = Math.cos(angle) * radius;
    group.current.position.z = Math.sin(angle) * radius;
    
    // Bobbing up and down slightly
    group.current.position.y = heightOffset + Math.sin(time * 2 + offset) * 0.3;
    
    // Face the direction of flight (tangent to the circle)
    // We add Math.PI if the model is facing backwards by default, adjust if needed
    group.current.rotation.y = -angle + Math.PI; 
    
    // Slight banking (roll) based on the turn
    group.current.rotation.z = Math.sin(time * 3 + offset) * 0.15 + 0.2; // bank into the turn
    // Pitching up and down slightly
    group.current.rotation.x = Math.cos(time * 2 + offset) * 0.1;
  });

  return (
    <group ref={group}>
      <primitive object={clone} scale={0.4} />
    </group>
  );
}

function Flock() {
  const group = useRef();

  // We rotate the entire flock group slowly as well for extra dynamism
  useFrame((state, delta) => {
    group.current.rotation.y += delta * 0.1;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1; // Gentle tilt of the whole vortex
  });

  // 6 paper airplanes flying in a formation
  return (
    <group ref={group}>
      <Airplane offset={0} radius={2.5} speed={0.8} heightOffset={0} />
      <Airplane offset={Math.PI / 3} radius={2.0} speed={1.0} heightOffset={0.5} />
      <Airplane offset={(Math.PI / 3) * 2} radius={3.0} speed={0.7} heightOffset={-0.5} />
      <Airplane offset={Math.PI} radius={2.2} speed={0.9} heightOffset={0.2} />
      <Airplane offset={(Math.PI / 3) * 4} radius={2.8} speed={0.75} heightOffset={-0.2} />
      <Airplane offset={(Math.PI / 3) * 5} radius={1.8} speed={1.1} heightOffset={0.8} />
    </group>
  );
}

export default function AsciiAirplane({ className = '' }) {
  return (
    <div className={`absolute inset-0 pointer-events-none select-none ${className}`}>
      <Canvas camera={{ position: [0, 4, 8], fov: 45 }}>
        <color attach="background" args={['#FFF8E7']} />
        
        {/* Soft lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        
        <Suspense fallback={null}>
          <Flock />
          
          {/* Beautiful soft shadows on the "ground" */}
          <ContactShadows 
            position={[0, -2, 0]} 
            opacity={0.7} 
            scale={20} 
            blur={2} 
            far={10} 
            color="#3300FF"
          />
        </Suspense>
        
        <AsciiRenderer 
          fgColor="#3300FF" 
          bgColor="#FFF8E7" 
          characters=" .:-+*=%@#" 
          resolution={0.18} 
          invert={false}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload('/paper_airplane.glb');
