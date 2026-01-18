/**
 * Ground tile node for isometric grid background.
 * Renders a single ground tile at a grid position.
 */
import type { NodeProps } from '@xyflow/react';
import { type FC, memo } from 'react';

/** Road tile variants based on neighbor connectivity */
export type RoadVariant =
  | 'cross' // 3-4 neighbors, intersection
  | 'corner-nw' // bend from north to west
  | 'corner-ne' // bend from north to east
  | 'corner-sw' // bend from south to west
  | 'corner-se' // bend from south to east
  | 'straight'; // default/fallback

/** Ground tile node data */
export interface GroundTileNodeData {
  tileType: 'grass' | 'grass-desaturated' | 'road' | 'dirt';
  roadVariant?: RoadVariant;
  col: number;
  row: number;
}

/** Asset paths */
const TILE_ASSETS: Record<string, string> = {
  grass: '/theme-assets/rpg2/grass-tile.png',
  'grass-desaturated': '/theme-assets/rpg2/grass-tile-desaturated.png',
  road: '/theme-assets/rpg2/road-tile.png',
  'road-cross': '/theme-assets/rpg2/road-cross.png',
  'road-corner-nw': '/theme-assets/rpg2/road-corner-nw.png',
  'road-corner-ne': '/theme-assets/rpg2/road-corner-ne.png',
  'road-corner-sw': '/theme-assets/rpg2/road-corner-sw.png',
  'road-corner-se': '/theme-assets/rpg2/road-corner-se.png',
  dirt: '/theme-assets/rpg2/dirt-tile.png',
};

/**
 * Ground tile node component.
 * Tile width matches isometric grid cellWidth (80px).
 * Offset centers the diamond shape on the grid position.
 */
export const GroundTileNode: FC<NodeProps> = memo(({ data }) => {
  const { tileType = 'grass', roadVariant } = data as unknown as GroundTileNodeData;

  // Determine which asset to use
  let assetKey: string = tileType;
  if (tileType === 'road' && roadVariant && roadVariant !== 'straight') {
    assetKey = `road-${roadVariant}`;
  }
  const src = TILE_ASSETS[assetKey] || TILE_ASSETS.grass;

  // Tile image is ~108px wide originally, scale to match 80px grid
  const tileWidth = 80;

  return (
    <div
      style={{
        pointerEvents: 'none',
        // Center the diamond tile on the grid point
        transform: `translate(-${tileWidth / 2}px, -25px)`,
      }}
    >
      <img
        alt=""
        draggable={false}
        src={src}
        style={{
          width: tileWidth,
          height: 'auto',
          display: 'block',
          userSelect: 'none',
        }}
      />
    </div>
  );
});

GroundTileNode.displayName = 'GroundTileNode';
