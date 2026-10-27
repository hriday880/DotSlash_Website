import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  shelfMetrics,
  DEPTH,
  PANEL_T,
  AWNING_BACK,
  AWNING_FRONT,
  AWNING_REACH,
} from './Bookshelf';
import { woodTexture, floorTexture, plasterTexture, stripeTexture, valanceTexture, fontsReady } from './textures';

const VALANCE_H = 0.24;
const WALL_W = 80;
const WALL_H = 14;
const FLOOR_D = 24;
const WAINSCOT_H = 0.85;

// Awning geometry shared with the lamp rig in Newsstand
export function awningGeometry(metrics) {
  const zBack = -DEPTH / 2;
  const zFront = DEPTH / 2 + AWNING_REACH;
  const yBack = metrics.topY + AWNING_BACK;
  const yFront = metrics.topY + AWNING_FRONT;
  return { zBack, zFront, yBack, yFront };
}

function Valance({ x, width, y, z, label, sub }) {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fontsReady.then(() => !cancelled && setFontsLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);
  const tex = useMemo(
    () => valanceTexture(label, sub, width / VALANCE_H),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label, sub, width, fontsLoaded]
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[x, y - VALANCE_H / 2, z]} castShadow>
      <planeGeometry args={[width, VALANCE_H]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.5} side={THREE.DoubleSide} roughness={0.8} />
    </mesh>
  );
}

function Pendant({ x, yTop, yShade, z, shadeMat, cordMat }) {
  const cordLen = yTop - yShade;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, yShade + cordLen / 2, 0]} material={cordMat}>
        <cylinderGeometry args={[0.004, 0.004, cordLen, 6]} />
      </mesh>
      <mesh position={[0, yShade - 0.04, 0]} material={shadeMat} castShadow>
        <cylinderGeometry args={[0.025, 0.09, 0.08, 24, 1, true]} />
      </mesh>
      <mesh position={[0, yShade - 0.075, 0]}>
        <sphereGeometry args={[0.03, 16, 12]} />
        <meshStandardMaterial color="#FFE7C2" emissive="#FFC98A" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PaperBundles({ position, paperMat, twineMat }) {
  const stack = [
    [0, 0.045, 0, 0.05],
    [0.02, 0.135, -0.01, -0.12],
    [-0.015, 0.225, 0.015, 0.2],
  ];
  return (
    <group position={position}>
      {stack.map(([x, y, z, ry], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, ry, 0]}>
          <mesh material={paperMat} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.09, 0.3]} />
          </mesh>
          <mesh material={twineMat}>
            <boxGeometry args={[0.012, 0.095, 0.305]} />
          </mesh>
          <mesh material={twineMat}>
            <boxGeometry args={[0.425, 0.095, 0.012]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Plant({ position }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * Math.PI * 2 + (i % 2) * 0.3;
        const tilt = 0.35 + (i % 3) * 0.18;
        return { a, tilt, len: 0.32 + (i % 4) * 0.05 };
      }),
    []
  );
  return (
    <group position={position}>
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.13, 0.34, 28]} />
        <meshStandardMaterial color="#B5643C" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[0.155, 0.155, 0.01, 28]} />
        <meshStandardMaterial color="#3B2A1E" roughness={1} />
      </mesh>
      {leaves.map(({ a, tilt, len }, i) => (
        <group key={i} position={[0, 0.33, 0]} rotation={[0, a, 0]}>
          <mesh
            rotation={[tilt, 0, 0]}
            position={[0, len * 0.5 * Math.cos(tilt), len * 0.5 * Math.sin(tilt)]}
            scale={[0.7, len / 0.12, 0.25]}
            castShadow
          >
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshStandardMaterial color={i % 2 ? '#2F6B3A' : '#3E8048'} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function StandSet({ cols, rows, pages }) {
  const metrics = shelfMetrics(cols, rows);
  const { pitch, floorY, topY } = metrics;
  const totalW = pages * pitch + PANEL_T;
  const midX = ((pages - 1) * pitch) / 2;
  const { zBack, zFront, yBack, yFront } = awningGeometry(metrics);
  const dz = zFront - zBack;
  const dy = yBack - yFront;
  const canopyLen = Math.hypot(dz, dy);
  const slope = Math.atan2(dy, dz);

  const mats = useMemo(() => {
    const stripes = stripeTexture({ repeat: [1, 1] });
    return {
      wall: new THREE.MeshStandardMaterial({
        map: plasterTexture({ repeat: [WALL_W / 2.5, WALL_H / 2.5] }),
        roughness: 0.95,
      }),
      wainscot: new THREE.MeshStandardMaterial({ color: '#1C2747', roughness: 0.8 }),
      trim: new THREE.MeshStandardMaterial({ map: woodTexture({ seed: 12, repeat: [20, 1] }), roughness: 0.5 }),
      floor: new THREE.MeshStandardMaterial({
        map: floorTexture({ repeat: [WALL_W / 1.6, FLOOR_D / 1.6] }),
        roughness: 0.6,
      }),
      canopy: new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.85, side: THREE.DoubleSide }),
      iron: new THREE.MeshStandardMaterial({ color: '#01040B', metalness: 0.6, roughness: 0.4 }),
      crate: new THREE.MeshStandardMaterial({ map: woodTexture({ seed: 21, base: '#C49563' }), roughness: 0.75 }),
      paper: new THREE.MeshStandardMaterial({ color: '#EFECE3', roughness: 1 }),
      twine: new THREE.MeshStandardMaterial({ color: '#8A6A44', roughness: 1 }),
    };
  }, []);

  useEffect(
    () => () =>
      Object.values(mats).forEach((m) => {
        m.map?.dispose();
        m.dispose();
      }),
    [mats]
  );

  // Stripe width stays constant (~0.13 units) however long the stand gets
  useEffect(() => {
    mats.canopy.map.repeat.set(totalW / 0.26, 1);
  }, [mats, totalW]);

  const leftEnd = -pitch / 2 - PANEL_T / 2;
  const rightEnd = (pages - 0.5) * pitch + PANEL_T / 2;

  return (
    <group>
      {/* Back wall with wainscoting */}
      <mesh position={[midX, floorY + WALL_H / 2, zBack - 0.01]} material={mats.wall} receiveShadow>
        <planeGeometry args={[WALL_W, WALL_H]} />
      </mesh>
      <mesh position={[midX, floorY + WAINSCOT_H / 2, zBack + 0.005]} material={mats.wainscot} receiveShadow>
        <boxGeometry args={[WALL_W, WAINSCOT_H, 0.02]} />
      </mesh>
      <mesh position={[midX, floorY + WAINSCOT_H + 0.02, zBack + 0.02]} material={mats.trim} castShadow receiveShadow>
        <boxGeometry args={[WALL_W, 0.04, 0.05]} />
      </mesh>
      <mesh position={[midX, floorY + 0.05, zBack + 0.02]} material={mats.trim} receiveShadow>
        <boxGeometry args={[WALL_W, 0.1, 0.04]} />
      </mesh>

      {/* Plank floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[midX, floorY, zBack + FLOOR_D / 2]} material={mats.floor} receiveShadow>
        <planeGeometry args={[WALL_W, FLOOR_D]} />
      </mesh>

      {/* Striped awning canopy */}
      <mesh
        position={[midX, (yBack + yFront) / 2, (zBack + zFront) / 2]}
        rotation={[slope - Math.PI / 2, 0, 0]}
        material={mats.canopy}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[totalW, canopyLen, 0.012]} />
      </mesh>
      {/* Front rail of the awning */}
      <mesh position={[midX, yFront, zFront]} rotation={[0, 0, Math.PI / 2]} material={mats.iron}>
        <cylinderGeometry args={[0.012, 0.012, totalW, 8]} />
      </mesh>

      {/* Lettered valance, one per bay so the name sits centred on screen */}
      {Array.from({ length: pages }, (_, b) => (
        <Valance
          key={`val-${b}-${pitch}`}
          x={b * pitch}
          width={pitch}
          y={yFront}
          z={zFront + 0.008}
          label="DOTSLASH MONTHLY"
          sub={`SHELF ${String(b + 1).padStart(2, '0')}`}
        />
      ))}

      {/* Iron support arms at every divider */}
      {Array.from({ length: pages + 1 }, (_, i) => {
        const x = (i - 0.5) * pitch;
        const ay = topY + 0.04;
        const armDy = yFront - ay;
        const len = Math.hypot(dz, armDy);
        return (
          <mesh
            key={`arm-${i}`}
            position={[x, (ay + yFront) / 2, (zBack + zFront) / 2]}
            rotation={[Math.atan2(dz, armDy), 0, 0]}
            material={mats.iron}
            castShadow
          >
            <cylinderGeometry args={[0.01, 0.01, len, 8]} />
          </mesh>
        );
      })}

      {/* Pendant lamps hanging from the awning */}
      {Array.from({ length: pages }, (_, b) =>
        [-1, 1].map((side) => {
          const z = DEPTH / 2 + 0.16;
          const yUnder = yBack - ((z - zBack) / dz) * dy;
          return (
            <Pendant
              key={`lamp-${b}-${side}`}
              x={b * pitch + (side * metrics.bayW) / 4}
              yTop={yUnder}
              yShade={topY + 0.2}
              z={z}
              shadeMat={mats.iron}
              cordMat={mats.iron}
            />
          );
        })
      )}

      {/* Props at both ends of the stand */}
      <group position={[leftEnd - 0.45, floorY, 0.05]}>
        <mesh position={[0, 0.19, 0]} material={mats.crate} castShadow receiveShadow>
          <boxGeometry args={[0.56, 0.38, 0.42]} />
        </mesh>
        <PaperBundles position={[0, 0.38, 0]} paperMat={mats.paper} twineMat={mats.twine} />
      </group>
      <Plant position={[rightEnd + 0.45, floorY, 0.05]} />
    </group>
  );
}
