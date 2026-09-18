import React, { useRef, Suspense, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, ContactShadows, Text, Html } from '@react-three/drei';
import * as THREE from 'three';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className="p-10 text-red-500 font-mono text-xs">{this.state.error.toString()}</div>;
    }
    return this.props.children;
  }
}

function Airplane({ offset, radius, speed, heightOffset }) {
  const { scene } = useGLTF('/paper_airplane.glb');
  
  const clone = useMemo(() => {
    const c = scene.clone();
    c.traverse((node) => {
      if (node.isMesh) {
        node.material = new THREE.MeshBasicMaterial({ color: '#FFF8E7' });
        const edges = new THREE.EdgesGeometry(node.geometry);
        const line = new THREE.LineSegments(
          edges, 
          new THREE.LineBasicMaterial({ color: '#3300FF', linewidth: 1 })
        );
        node.add(line);
      }
    });
    return c;
  }, [scene]);

  const group = useRef();
  const meshRef = useRef();

  useFrame((state) => {
    if (!group.current || !meshRef.current) return;
    const time = state.clock.elapsedTime;
    
    // Reverse the orbit direction
    const angle = -(time * speed) + offset;
    
    group.current.position.x = Math.cos(angle) * radius;
    group.current.position.z = Math.sin(angle) * radius;
    group.current.position.y = heightOffset + Math.sin(time * 2 + offset) * 0.3;
    
    // Face the direction of travel (tangent to the clockwise circle)
    group.current.rotation.y = -angle;
    
    meshRef.current.rotation.z = Math.sin(time * 3 + offset) * 0.2 + 0.3; 
    meshRef.current.rotation.x = Math.cos(time * 2 + offset) * 0.1; 
  });

  return (
    <group ref={group}>
      <group ref={meshRef}>
        <primitive 
          object={clone} 
          scale={0.85} 
          rotation={[-Math.PI / 2, Math.PI, 0]} 
        />
      </group>
    </group>
  );
}

function Flock() {
  const group = useRef();
  useFrame((state, delta) => {
    if(!group.current) return;
    group.current.rotation.y += delta * 0.15;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1; 
  });

  return (
    <group ref={group}>
      <Airplane offset={0} radius={4.5} speed={0.8} heightOffset={0} />
      <Airplane offset={Math.PI / 3} radius={3.5} speed={1.0} heightOffset={1.5} />
      <Airplane offset={(Math.PI / 3) * 2} radius={5.0} speed={0.7} heightOffset={-1.5} />
      <Airplane offset={Math.PI} radius={4.0} speed={0.9} heightOffset={0.5} />
      <Airplane offset={(Math.PI / 3) * 4} radius={5.5} speed={0.75} heightOffset={-0.8} />
      <Airplane offset={(Math.PI / 3) * 5} radius={3.0} speed={1.1} heightOffset={2.0} />
    </group>
  );
}

function ResponsiveScene({ title, subtitle, topText }) {
  const { viewport } = useThree();
  
  // Dynamically scale down the scene on mobile/narrow screens.
  // The max radius of the planes is 5.5 (diameter 11). To fit inside viewport.width with padding,
  // we divide viewport.width by 14.
  const scale = Math.min(1, viewport.width / 14);

  return (
    <group scale={scale}>
      <Flock />
      
      <ContactShadows 
        position={[0, -4, 0]} 
        opacity={0.3} 
        scale={30} 
        blur={2.5} 
        far={10} 
        color="#030303"
      />

      <group position={[0, 0, 0]}>
        {topText && (
          <Html transform center position={[0, 3, 0]} zIndexRange={[100, 0]}>
            <div className="flex items-center justify-center gap-2 md:gap-3 font-mono text-[10px] md:text-xs text-[#3300FF] tracking-widest uppercase font-bold whitespace-nowrap">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#3300FF] rounded-full animate-pulse"></span>
              {topText}
            </div>
          </Html>
        )}

        <Text
          position={[0, 0, 0]}
          fontSize={title.length > 15 ? 1.5 : 2.5}
          color="#3300FF"
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          maxWidth={12}
          lineHeight={0.9}
        >
          {title}
        </Text>

        {subtitle && (
          <Html transform center position={[0, -3, 0]} zIndexRange={[100, 0]}>
            <div className="font-mono text-xs md:text-sm text-[#3300FF] tracking-[0.1em] md:tracking-[0.2em] uppercase font-bold whitespace-nowrap">
              {subtitle}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

export default function InkAirplane({ title = "", subtitle = "", topText = "" }) {
  return (
    <ErrorBoundary>
      <div className="absolute inset-0 w-full h-full select-none overflow-hidden">
        <Canvas camera={{ position: [0, 0, 12], fov: 45 }}>
          <Suspense fallback={null}>
            <ResponsiveScene title={title} subtitle={subtitle} topText={topText} />
          </Suspense>
        </Canvas>
      </div>
    </ErrorBoundary>
  );
}

useGLTF.preload('/paper_airplane.glb');
