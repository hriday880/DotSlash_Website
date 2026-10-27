import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import Newspaper, { PAPER_H } from './Newspaper';
import { woodTexture } from './textures';

// Shelf dimensions (world units)
export const CELL_W = 0.82;
export const CELL_H = PAPER_H + 0.22;
export const BOARD_T = 0.045;
export const PANEL_T = 0.07;
export const DEPTH = 0.42;
export const PLINTH = 0.14;
// Awning: hinged on the wall above the shelf, sloping forward and down
export const AWNING_BACK = 0.55;
export const AWNING_FRONT = 0.32;
export const AWNING_REACH = 0.5;

export function shelfMetrics(cols, rows) {
  const bayW = cols * CELL_W;
  const H = rows * CELL_H;
  const floorY = -H / 2 - BOARD_T - PLINTH;
  const topY = H / 2 + BOARD_T;
  const fitTop = topY + AWNING_BACK;
  return {
    bayW,
    H,
    topY,
    floorY,
    pitch: bayW + PANEL_T,
    // Bounding box of one bay (shelf + awning), used by the camera to frame it exactly
    fitW: bayW + PANEL_T * 2,
    fitH: fitTop - floorY,
    centerY: (fitTop + floorY) / 2,
    frontZ: DEPTH / 2 + AWNING_REACH,
  };
}

export default function Bookshelf({ blogs, cols, rows, pages, hoveredSlug, onOpen, onHover }) {
  const { bayW, H, pitch } = shelfMetrics(cols, rows);
  const perPage = cols * rows;
  const totalW = pages * pitch + PANEL_T;
  const midX = ((pages - 1) * pitch) / 2;

  const mats = useMemo(() => {
    const board = new THREE.MeshStandardMaterial({ map: woodTexture({ seed: 4, repeat: [2, 1] }), roughness: 0.55 });
    const panel = new THREE.MeshStandardMaterial({ map: woodTexture({ seed: 9, rotate: true }), roughness: 0.55 });
    return {
      board,
      panel,
      back: new THREE.MeshStandardMaterial({ color: '#1C2747', roughness: 0.95 }),
      plinth: new THREE.MeshStandardMaterial({ color: '#4A2F1B', roughness: 0.7 }),
      lip: new THREE.MeshStandardMaterial({ color: '#C9A24A', metalness: 0.85, roughness: 0.3 }),
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

  const slotPosition = (i) => {
    const bay = Math.floor(i / perPage);
    const slot = i % perPage;
    const r = Math.floor(slot / cols);
    const c = slot % cols;
    return [bay * pitch - bayW / 2 + (c + 0.5) * CELL_W, H / 2 - (r + 1) * CELL_H, DEPTH / 2 - 0.07];
  };

  const items = useMemo(
    () => blogs.map((blog, i) => ({ blog, position: slotPosition(i) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blogs, perPage, cols, pitch, bayW, H]
  );


  const boardYs = Array.from({ length: rows }, (_, r) => H / 2 - (r + 1) * CELL_H);
  const fullH = H + BOARD_T * 2 + PLINTH;

  return (
    <group>
      {/* Back panel */}
      <mesh position={[midX, -PLINTH / 2, -DEPTH / 2 + 0.01]} material={mats.back} receiveShadow>
        <boxGeometry args={[totalW, fullH, 0.02]} />
      </mesh>

      {/* Top cap */}
      <mesh position={[midX, H / 2 + BOARD_T / 2, 0.01]} material={mats.board} castShadow receiveShadow>
        <boxGeometry args={[totalW + 0.04, BOARD_T, DEPTH + 0.04]} />
      </mesh>

      {/* Plinth */}
      <mesh position={[midX, -H / 2 - BOARD_T - PLINTH / 2, -0.02]} material={mats.plinth} receiveShadow>
        <boxGeometry args={[totalW, PLINTH, DEPTH - 0.04]} />
      </mesh>

      {/* Side panels / bay dividers */}
      {Array.from({ length: pages + 1 }, (_, i) => (
        <mesh key={`panel-${i}`} position={[(i - 0.5) * pitch, -PLINTH / 2, 0]} material={mats.panel} castShadow receiveShadow>
          <boxGeometry args={[PANEL_T, fullH, DEPTH]} />
        </mesh>
      ))}

      {/* Shelves with a brass rail that holds the papers */}
      {Array.from({ length: pages }, (_, b) =>
        boardYs.map((y, r) => (
          <group key={`shelf-${b}-${r}`} position={[b * pitch, y, 0]}>
            <mesh position={[0, -BOARD_T / 2, 0]} material={mats.board} castShadow receiveShadow>
              <boxGeometry args={[bayW, BOARD_T, DEPTH]} />
            </mesh>
            <mesh position={[0, 0.05, DEPTH / 2 - 0.015]} rotation={[0, 0, Math.PI / 2]} material={mats.lip} castShadow>
              <cylinderGeometry args={[0.008, 0.008, bayW, 8]} />
            </mesh>
            {Array.from({ length: cols + 1 }, (_, k) => (
              <mesh
                key={k}
                position={[-bayW / 2 + 0.03 + (k * (bayW - 0.06)) / cols, 0.025, DEPTH / 2 - 0.015]}
                material={mats.lip}
              >
                <cylinderGeometry args={[0.006, 0.006, 0.05, 6]} />
              </mesh>
            ))}
          </group>
        ))
      )}

      {items.map(({ blog, position }) => (
        <Newspaper
          key={blog.slug}
          blog={blog}
          position={position}
          isHovered={hoveredSlug === blog.slug}
          onOpen={onOpen}
          onHover={onHover}
        />
      ))}
    </group>
  );
}
