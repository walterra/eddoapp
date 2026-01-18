/**
 * Hook for multiple walking characters animation.
 * Each metadata node (agent/signpost) gets its own walking character.
 */
import { useEffect, useRef, useState } from 'react';

import { gridToScreen, type RoadNetworkData } from './isometric_layout';
import {
  createAnimController,
  findNearestRoad,
  isOnTodoTile,
  type AnimState,
  type CharacterState,
  type WalkingCharactersResult,
} from './walking_characters';

// Re-export types for external use
export type { CharacterState, WalkingCharactersResult };

/** Initialize characters from road network */
const initializeCharacters = (
  rn: RoadNetworkData,
): { chars: CharacterState[]; states: Map<string, AnimState> } => {
  const chars: CharacterState[] = [];
  const states = new Map<string, AnimState>();

  for (const [id, metaPos] of rn.metadataPositions.entries()) {
    const startRoad = findNearestRoad(metaPos, rn.roadTiles);
    if (!startRoad) continue;

    const screenPos = gridToScreen(startRoad, rn.config);
    const isOnHouse = isOnTodoTile(startRoad, rn.todoPositions);

    chars.push({
      id,
      screenPos,
      path: [screenPos],
      gridPath: [startRoad],
      pathIndex: 0,
      isWalking: false,
      hasBubblePermission: false,
      isOnHouse,
    });

    states.set(id, {
      gridPos: startRoad,
      path: [startRoad],
      pathIndex: 0,
      isAnimating: false,
      timerId: null,
    });
  }

  return { chars, states };
};

/** Hook for managing walking characters animation */
export function useWalkingCharacters(roadNetwork: RoadNetworkData | null): WalkingCharactersResult {
  const [characters, setCharacters] = useState<CharacterState[]>([]);
  const statesRef = useRef<Map<string, AnimState>>(new Map());
  const mountedRef = useRef(true);
  const bubbleLockRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const isInvalidNetwork =
      !roadNetwork || roadNetwork.roadTiles.size === 0 || roadNetwork.metadataPositions.size === 0;

    if (isInvalidNetwork) {
      setCharacters([]);
      return;
    }

    // Clear existing timers
    for (const s of statesRef.current.values()) {
      if (s.timerId) clearTimeout(s.timerId);
    }

    // Reset bubble lock
    bubbleLockRef.current = null;

    // Initialize new characters
    const { chars, states } = initializeCharacters(roadNetwork);
    statesRef.current = states;
    setCharacters(chars);

    // Create animation controller and start walking
    const { startWalking } = createAnimController({
      statesRef,
      mountedRef,
      setCharacters,
      bubbleLockRef,
      roadNetwork,
    });

    Array.from(states.keys()).forEach((id, idx) => {
      setTimeout(() => startWalking(id), 500 + idx * 500);
    });

    return () => {
      for (const s of statesRef.current.values()) {
        if (s.timerId) clearTimeout(s.timerId);
      }
    };
  }, [roadNetwork]);

  return { characters };
}
