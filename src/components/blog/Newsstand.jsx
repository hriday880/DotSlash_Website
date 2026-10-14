import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import NewspaperRack from './NewspaperRack';

export default function Newsstand({ blogs, activeSlug, onOpen, rotationTarget }) {
  // Use a fallback if there's no webgl or motion preferred
  // but for this task we assume WebGL is supported
  
  return (
    <Canvas shadows dpr={[1, 1.5]}>
      <PerspectiveCamera makeDefault position={[0, 1, 6]} fov={45} />
      <color attach="background" args={['#EBEDF5']} />
      <fog attach="fog" args={['#EBEDF5', 5, 20]} />
      
      {/* Lights */}
      <ambientLight intensity={1.5} />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={2} 
        castShadow 
        shadow-mapSize={1024}
        color="#ffffff" 
      />

      {/* Environment for shiny metal materials */}
      <Environment preset="city" />

      {/* Grid Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#EBEDF5" roughness={1} />
      </mesh>
      <gridHelper args={[100, 50, '#717784', '#a1a1aa']} position={[0, -1.99, 0]} />

      <Suspense fallback={null}>
        <NewspaperRack 
          blogs={blogs} 
          activeSlug={activeSlug} 
          onOpen={onOpen} 
          rotationTarget={rotationTarget}
        />
      </Suspense>

      {/* Limit controls so user can't get lost */}
      <OrbitControls 
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2 + 0.1}
      />
    </Canvas>
  );
}
