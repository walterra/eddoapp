/**
 * Persona system for the Telegram bot
 */
import type { Persona } from './persona-types.js';
import { butler } from './personas/butler.js';
import { gtdCoach } from './personas/gtd-coach.js';
import { zenMaster } from './personas/zen-master.js';

// Re-export types
export type { Persona } from './persona-types.js';

export const personas: Record<string, Persona> = {
  butler,
  gtd_coach: gtdCoach,
  zen_master: zenMaster,
};

/**
 * Get persona by ID, fallback to butler if not found
 */
export function getPersona(personaId: string): Persona {
  return personas[personaId] || personas.butler;
}

