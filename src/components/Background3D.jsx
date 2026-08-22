import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function ParticleWave() {
 const mesh = useRef();
 const { mouse } = useThree();
 const dummy = useMemo(() => new THREE.Object3D(), []);
 const gridWidth = 45;
 const gridDepth = 45;
 const count = gridWidth * gridDepth;

 const gridData = useMemo(() => {
 const data = [];
 const stepX = 50 / gridWidth;
 const stepZ = 50 / gridDepth;
 for (let x = 0; x < gridWidth; x++) {
  for (let z = 0; z < gridDepth; z++) {
  const posX = (x - gridWidth / 2) * stepX;
  const posZ = (z - gridDepth / 2) * stepZ;
  data.push({
   x: posX,
   z: posZ,
   phase: Math.random() * Math.PI * 2,
   speed: 0.8 + Math.random() * 0.4,
  });
  }
 }
 return data;
 }, []);

 // Updated brand colors: #3300FF (electric blue) to #00D4FF (cyan)
 const color1 = useMemo(() => new THREE.Color('#3300FF'), []);
 const color2 = useMemo(() => new THREE.Color('#00D4FF'), []);
 const tempColor = useMemo(() => new THREE.Color(), []);

 useEffect(() => {
 if (!mesh.current) return;
 for (let i = 0; i < count; i++) {
  mesh.current.setColorAt(i, color1);
 }
 if (mesh.current.instanceColor) {
  mesh.current.instanceColor.needsUpdate = true;
 }
 }, [count, color1]);

 useFrame(({ clock }) => {
 if (!mesh.current) return;
 const t = clock.getElapsedTime();

 const mx = mouse.x * 15;
 const mz = -mouse.y * 15;

 for (let i = 0; i < count; i++) {
  const { x, z, phase, speed } = gridData[i];

  const dx = x - mx;
  const dz = z - mz;
  const dist = Math.sqrt(dx * dx + dz * dz);

  const wave1 = Math.sin(x * 0.3 + t * speed + phase) * 0.8;
  const wave2 = Math.cos(z * 0.3 + t * 0.6) * 0.8;
  const mouseWave = Math.sin(dist * 0.6 - t * 2.5) * Math.max(0, 1 - dist / 12) * 1.5;

  const y = wave1 + wave2 + mouseWave - 2;

  dummy.position.set(x, y, z);
  const scale = 0.6 + 0.4 * Math.sin(phase + t * 1.5);
  dummy.scale.set(scale, scale, scale);
  dummy.rotation.x = t * 0.2 + phase;
  dummy.rotation.y = t * 0.3 + phase;
  dummy.updateMatrix();

  mesh.current.setMatrixAt(i, dummy.matrix);

  const factor = THREE.MathUtils.clamp((y + 3.5) / 4.5, 0, 1);
  tempColor.copy(color1).lerp(color2, factor);
  mesh.current.setColorAt(i, tempColor);
 }

 mesh.current.instanceMatrix.needsUpdate = true;
 if (mesh.current.instanceColor) {
  mesh.current.instanceColor.needsUpdate = true;
 }
 });

 return (
 <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
  <dodecahedronGeometry args={[0.12, 0]} />
  <meshStandardMaterial
  roughness={0.3}
  metalness={0.8}
  emissive="#0A0E27"
  emissiveIntensity={0.2}
  />
 </instancedMesh>
 );
}

function StarField() {
 const pointsRef = useRef();
 const count = 400;

 const [positions, initialPositions] = useMemo(() => {
 const pos = new Float32Array(count * 3);
 const initPos = new Float32Array(count * 3);
 for (let i = 0; i < count; i++) {
  const i3 = i * 3;
  const x = (Math.random() - 0.5) * 60;
  const y = (Math.random() - 0.5) * 40;
  const z = (Math.random() - 0.5) * 50;
  pos[i3] = x;
  pos[i3 + 1] = y;
  pos[i3 + 2] = z;
  initPos[i3] = x;
  initPos[i3 + 1] = y;
  initPos[i3 + 2] = z;
 }
 return [pos, initPos];
 }, [count]);

 useFrame(({ clock }) => {
 if (!pointsRef.current) return;
 const t = clock.getElapsedTime();
 const posAttr = pointsRef.current.geometry.attributes.position;

 for (let i = 0; i < count; i++) {
  const i3 = i * 3;
  posAttr.array[i3 + 1] = initialPositions[i3 + 1] + Math.sin(t * 0.3 + initialPositions[i3]) * 1.5;
  posAttr.array[i3] = initialPositions[i3] + Math.cos(t * 0.2 + initialPositions[i3 + 2]) * 0.8;
 }
 posAttr.needsUpdate = true;
 });

 return (
 <points ref={pointsRef}>
  <bufferGeometry>
  <bufferAttribute
   attach="attributes-position"
   count={count}
   array={positions}
   itemSize={3}
  />
  </bufferGeometry>
  <pointsMaterial
  size={0.06}
  color="#00D4FF"
  transparent
  opacity={0.6}
  sizeAttenuation
  />
 </points>
 );
}

export default function Background3D() {
 return (
 <div className="fixed inset-0 z-0 pointer-events-none">
  <Canvas
  camera={{ position: [0, 2, 18], fov: 55 }}
  gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
  >
  <color attach="background" args={['#030305']} />
  <fog attach="fog" args={['#030305', 10, 35]} />
  <ambientLight intensity={0.6} />
  <directionalLight position={[10, 10, 5]} intensity={1} color="#00D4FF" />
  <pointLight position={[-10, -5, -5]} intensity={0.8} color="#3300FF" />
  <ParticleWave />
  <StarField />
  </Canvas>
 </div>
 );
}
