import React, { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import Bookshelf, { shelfMetrics, DEPTH } from './Bookshelf';
import StandSet from './StandSet';

const FOV = 30;
const MARGIN = 1.16; // breathing room around the framed bay (leaves room for the wiggle)
// Max cursor parallax as a fraction of camera distance, so the wiggle feels
// the same whether the shelf is one compartment or a whole wall
const WIGGLE_X = 0.14;
const WIGGLE_Y = 0.07;
const IDLE_AFTER = 2.5; // seconds without pointer movement before the idle sway kicks in

// Locked camera: no user orbit/zoom. Distance is solved from the viewport
// aspect so one full bay (shelf + awning) always fits on screen; paging only
// pans along x. The lights ride along so shadows stay sharp on long stands.
function CameraRig({ metrics, page }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const rig = useRef();

  const distance = useMemo(() => {
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const aspect = size.width / size.height;
    const byHeight = metrics.fitH / 2 / tanV;
    const byWidth = metrics.fitW / 2 / (tanV * aspect);
    return metrics.frontZ + Math.max(byHeight, byWidth) * MARGIN;
  }, [metrics, size.width, size.height]);

  const targetX = page * metrics.pitch;

  useLayoutEffect(() => {
    camera.fov = FOV;
    camera.position.set(targetX, metrics.centerY, distance);
    camera.lookAt(targetX, metrics.centerY, 0);
    camera.updateProjectionMatrix();
    // Only re-snap when the framing changes, not on every page flip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, distance, metrics]);

  // Panned base position + a small cursor-driven parallax offset. The camera
  // always looks back at the bay centre, so the wiggle never breaks framing.
  // When the pointer rests (or on touch screens), a slow figure-eight sway
  // keeps the depth readable.
  const base = useRef({ x: targetX, ox: 0, oy: 0, px: 0, py: 0, still: IDLE_AFTER });
  useFrame((state, delta) => {
    const b = base.current;
    const { x: px, y: py } = state.pointer;
    b.still = px === b.px && py === b.py ? b.still + delta : 0;
    b.px = px;
    b.py = py;
    const t = state.clock.elapsedTime;
    const idle = THREE.MathUtils.smoothstep(b.still, IDLE_AFTER, IDLE_AFTER + 1.5);
    const tx = THREE.MathUtils.lerp(px, Math.sin(t * 0.35) * 0.6, idle);
    const ty = THREE.MathUtils.lerp(py, Math.sin(t * 0.7) * 0.4, idle);
    b.x = THREE.MathUtils.damp(b.x, targetX, 5, delta);
    b.ox = THREE.MathUtils.damp(b.ox, tx * WIGGLE_X * distance, 2.5, delta);
    b.oy = THREE.MathUtils.damp(b.oy, ty * WIGGLE_Y * distance, 2.5, delta);
    camera.position.set(b.x + b.ox, metrics.centerY + b.oy, distance);
    camera.lookAt(b.x, metrics.centerY, 0);
    if (rig.current) rig.current.position.x = b.x;
  });

  const keyTarget = useMemo(() => new THREE.Object3D(), []);
  const spotTargets = useMemo(() => [new THREE.Object3D(), new THREE.Object3D()], []);
  const lampZ = DEPTH / 2 + 0.16;
  const lampY = metrics.topY + 0.12;

  return (
    <group ref={rig}>
      <primitive object={keyTarget} position={[0, metrics.centerY, 0]} />
      <directionalLight
        position={[3, metrics.topY + 4, 6]}
        intensity={0.9}
        color="#F4F1FF"
        target={keyTarget}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      {/* Warm pools from the two pendant lamps over the current bay */}
      {[-1, 1].map((side, i) => {
        const x = (side * metrics.bayW) / 4;
        return (
          <group key={side}>
            <primitive object={spotTargets[i]} position={[x, -metrics.H / 4, 0]} />
            <spotLight
              position={[x, lampY, lampZ]}
              target={spotTargets[i]}
              color="#FFD3A1"
              intensity={3.5}
              distance={8}
              decay={1.6}
              angle={0.75}
              penumbra={0.9}
            />
          </group>
        );
      })}
    </group>
  );
}

export default function Newsstand({ blogs, cols, rows, page, pages, hoveredSlug, onOpen, onHover }) {
  const metrics = useMemo(() => shelfMetrics(cols, rows), [cols, rows]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 80, position: [0, 0, 8] }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      onPointerMissed={() => onHover(null)}
    >
      <color attach="background" args={['#E8E3D8']} />

      <hemisphereLight args={['#FFF8EE', '#8C6A4A', 0.55]} />
      <CameraRig metrics={metrics} page={page} />

      {/* Local studio reflections (no HDR download) */}
      <Environment resolution={128} environmentIntensity={0.3}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 5]} scale={[12, 3, 1]} />
        <Lightformer form="rect" intensity={1} color="#FFD3A1" position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#B8C4FF" position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
      </Environment>

      <Suspense fallback={null}>
        <StandSet cols={cols} rows={rows} pages={pages} />
        <Bookshelf
          blogs={blogs}
          cols={cols}
          rows={rows}
          pages={pages}
          hoveredSlug={hoveredSlug}
          onOpen={onOpen}
          onHover={onHover}
        />
      </Suspense>
    </Canvas>
  );
}
