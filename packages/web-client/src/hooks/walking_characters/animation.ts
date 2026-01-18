/**
 * Animation controller for walking characters.
 */
import type React from 'react';

import { gridToScreen, type GridPosition, type RoadNetworkData } from '../isometric_layout';

import { canHoldBubbleForSteps, findPath, isOnTodoTile, pickDestination } from './pathfinding';
import type { AnimState, CharacterState } from './types';

const MIN_BUBBLE_STEPS = 3;

export interface ControllerDeps {
  statesRef: React.MutableRefObject<Map<string, AnimState>>;
  mountedRef: React.MutableRefObject<boolean>;
  setCharacters: React.Dispatch<React.SetStateAction<CharacterState[]>>;
  bubbleLockRef: React.MutableRefObject<string | null>;
  roadNetwork: RoadNetworkData;
}

interface AnimStepContext {
  charId: string;
  deps: ControllerDeps;
}

/** Handle reaching destination */
const handleDestinationReached = (
  ctx: AnimStepContext,
  state: AnimState,
  restartWalking: () => void,
): void => {
  const { charId, deps } = ctx;
  const { setCharacters, bubbleLockRef, roadNetwork } = deps;

  state.isAnimating = false;
  // Release bubble permission when reaching destination
  if (bubbleLockRef.current === charId) {
    bubbleLockRef.current = null;
  }
  // Mark as not walking when pausing
  const isOnHouse = isOnTodoTile(state.gridPos, roadNetwork.todoPositions);
  setCharacters((prev) =>
    prev.map((c) =>
      c.id === charId ? { ...c, isWalking: false, hasBubblePermission: false, isOnHouse } : c,
    ),
  );
  state.timerId = window.setTimeout(restartWalking, 2000 + Math.random() * 3000);
};

interface BubblePermissionParams {
  charId: string;
  state: AnimState;
  isOnHouse: boolean;
  bubbleLockRef: React.MutableRefObject<string | null>;
  todoPositions: Map<string, GridPosition>;
}

/** Update bubble permission based on current state */
const updateBubblePermission = (params: BubblePermissionParams): boolean => {
  const { charId, state, isOnHouse, bubbleLockRef, todoPositions } = params;
  let hasBubble = bubbleLockRef.current === charId;

  // Release bubble if entering a house
  if (hasBubble && isOnHouse) {
    bubbleLockRef.current = null;
    hasBubble = false;
  }

  // Try to acquire bubble if free and conditions allow
  if (!hasBubble && bubbleLockRef.current === null && !isOnHouse) {
    const canAcquire = canHoldBubbleForSteps(
      state.path,
      state.pathIndex,
      todoPositions,
      MIN_BUBBLE_STEPS,
    );
    if (canAcquire) {
      bubbleLockRef.current = charId;
      hasBubble = true;
    }
  }

  return hasBubble;
};

/** Process a single animation step */
const processAnimStep = (ctx: AnimStepContext, restartWalking: () => void): void => {
  const { charId, deps } = ctx;
  const { statesRef, mountedRef, setCharacters, bubbleLockRef, roadNetwork } = deps;
  const { todoPositions, config } = roadNetwork;

  if (!mountedRef.current) return;
  const state = statesRef.current.get(charId);
  if (!state) return;

  if (state.pathIndex >= state.path.length) {
    handleDestinationReached(ctx, state, restartWalking);
    return;
  }

  state.gridPos = state.path[state.pathIndex];
  state.pathIndex += 1;
  const screenPos = gridToScreen(state.gridPos, config);
  const isOnHouse = isOnTodoTile(state.gridPos, todoPositions);

  const hasBubble = updateBubblePermission({
    charId,
    state,
    isOnHouse,
    bubbleLockRef,
    todoPositions,
  });

  setCharacters((prev) =>
    prev.map((c) =>
      c.id === charId
        ? {
            ...c,
            screenPos,
            pathIndex: state.pathIndex,
            gridPath: state.path,
            isWalking: true,
            hasBubblePermission: hasBubble,
            isOnHouse,
          }
        : c,
    ),
  );
  state.timerId = window.setTimeout(() => processAnimStep(ctx, restartWalking), 800);
};

/** Start character walking to a new destination */
const startCharacterWalking = (charId: string, deps: ControllerDeps): void => {
  const { statesRef, mountedRef, setCharacters, bubbleLockRef, roadNetwork } = deps;
  const { roadTiles, todoPositions, config } = roadNetwork;

  if (!mountedRef.current) return;
  const state = statesRef.current.get(charId);
  if (!state || state.isAnimating) return;

  const dest = pickDestination(state.gridPos, todoPositions, roadTiles);
  const path = dest ? findPath(state.gridPos, dest, roadTiles) : null;
  if (!path || path.length < 2) {
    state.timerId = window.setTimeout(() => startCharacterWalking(charId, deps), 1000);
    return;
  }

  state.path = path;
  state.pathIndex = 1;
  state.isAnimating = true;

  // Check if starting on a house
  const isOnHouse = isOnTodoTile(state.gridPos, todoPositions);

  // Try to acquire bubble permission
  const canAcquire =
    bubbleLockRef.current === null &&
    !isOnHouse &&
    canHoldBubbleForSteps(path, 1, todoPositions, MIN_BUBBLE_STEPS);
  if (canAcquire) {
    bubbleLockRef.current = charId;
  }

  // Mark as walking when starting to move
  const screenPath = path.map((p) => gridToScreen(p, config));
  setCharacters((prev) =>
    prev.map((c) =>
      c.id === charId
        ? {
            ...c,
            path: screenPath,
            gridPath: path,
            pathIndex: 1,
            isWalking: true,
            hasBubblePermission: canAcquire,
            isOnHouse,
          }
        : c,
    ),
  );

  const restartWalking = () => startCharacterWalking(charId, deps);
  processAnimStep({ charId, deps }, restartWalking);
};

/** Creates animation controller functions */
export const createAnimController = (
  deps: ControllerDeps,
): { startWalking: (charId: string) => void } => {
  const startWalking = (charId: string) => startCharacterWalking(charId, deps);
  return { startWalking };
};
