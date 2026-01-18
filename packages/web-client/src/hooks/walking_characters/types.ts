/**
 * Type definitions for walking characters animation.
 */
import type { GridPosition } from '../isometric_layout';

export interface CharacterState {
  id: string;
  screenPos: { x: number; y: number };
  path: Array<{ x: number; y: number }>;
  pathIndex: number;
  /** Grid path for forecasting */
  gridPath: GridPosition[];
  /** Whether the character is currently walking (not paused) */
  isWalking: boolean;
  /** Whether this character has permission to show the speech bubble */
  hasBubblePermission: boolean;
  /** Whether the character is currently on a house (todo) tile */
  isOnHouse: boolean;
}

export interface AnimState {
  gridPos: GridPosition;
  path: GridPosition[];
  pathIndex: number;
  isAnimating: boolean;
  timerId: number | null;
}

export interface WalkingCharactersResult {
  characters: CharacterState[];
}
