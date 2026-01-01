/**
 * VCR-style Cassette Manager for LLM Response Caching
 *
 * Records LLM API responses to cassette files on first run,
 * replays them on subsequent runs for deterministic, fast, free tests.
 */
import { existsSync, mkdirSync } from 'fs';

import {
  createInteractionRecord,
  createNewCassette,
  getCassettePath,
  hashRequest,
  loadCassetteFromFile,
  logHashMismatch,
  saveCassetteToFile,
} from './cassette-helpers.js';

/** Recorded LLM interaction */
export interface LLMInteraction {
  requestHash: string;
  request: {
    model: string;
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
  };
  response: string;
  metadata: {
    recordedAt: string;
    responseTimeMs?: number;
  };
}

/** Cassette file structure */
export interface Cassette {
  version: 1;
  testName: string;
  createdAt: string;
  frozenTime: string;
  interactions: LLMInteraction[];
}

/** Recording mode */
export type RecordMode = 'record' | 'playback' | 'auto';

/** Cassette manager configuration */
export interface CassetteManagerConfig {
  cassettesDir: string;
  mode: RecordMode;
}

/** Callback to freeze/unfreeze time */
export interface TimeController {
  freeze: (isoTime: string) => void;
  unfreeze: () => void;
}

/** Internal state for cassette manager */
interface CassetteState {
  cassette: Cassette | null;
  path: string | null;
  index: number;
  modified: boolean;
  timeFrozen: boolean;
}

/**
 * Factory function to create a cassette manager
 */
export function createCassetteManager(
  config: CassetteManagerConfig,
  timeController?: TimeController,
) {
  const { cassettesDir, mode } = config;
  const state: CassetteState = {
    cassette: null,
    path: null,
    index: 0,
    modified: false,
    timeFrozen: false,
  };

  if (!existsSync(cassettesDir)) {
    mkdirSync(cassettesDir, { recursive: true });
  }

  function saveCassette(): void {
    if (!state.cassette || !state.path) return;
    saveCassetteToFile(state.path, state.cassette);
    state.modified = false;
  }

  function unfreezeTime(): void {
    if (state.timeFrozen && timeController) {
      timeController.unfreeze();
      state.timeFrozen = false;
    }
  }

  function freezeTime(isoTime: string): void {
    if (timeController && isoTime) {
      if (process.env.VCR_DEBUG) {
        console.log(`📼 Freezing time to: ${isoTime}`);
      }
      timeController.freeze(isoTime);
      state.timeFrozen = true;
    }
  }

  function loadCassette(testName: string): void {
    if (state.cassette && state.modified && state.path) {
      saveCassette();
    }
    unfreezeTime();

    state.path = getCassettePath(cassettesDir, testName);
    state.index = 0;
    state.modified = false;

    if (existsSync(state.path) && mode !== 'record') {
      state.cassette = loadCassetteFromFile(state.path);
      if (process.env.VCR_DEBUG) {
        const safeName = testName.replace(/[^a-zA-Z0-9-_]/g, '_');
        console.log(
          `📼 Loaded cassette: ${safeName} (${state.cassette.interactions.length} interactions)`,
        );
      }
      freezeTime(state.cassette.frozenTime);
    } else {
      state.cassette = createNewCassette(testName);
      if (mode === 'playback') {
        throw new Error(`Cassette not found for playback: ${state.path}`);
      }
      if (process.env.VCR_DEBUG) {
        const safeName = testName.replace(/[^a-zA-Z0-9-_]/g, '_');
        console.log(`📼 Created new cassette: ${safeName}`);
      }
    }
  }

  function tryReplayInteraction(
    requestHash: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
  ): { replayed: boolean; response?: string } {
    if (!state.cassette || mode === 'record') {
      return { replayed: false };
    }

    if (state.index >= state.cassette.interactions.length) {
      return { replayed: false };
    }

    const interaction = state.cassette.interactions[state.index];

    if (interaction.requestHash === requestHash) {
      state.index++;
      if (process.env.VCR_DEBUG) {
        console.log(
          `📼 Replaying interaction ${state.index}/${state.cassette.interactions.length}`,
        );
      }
      return { replayed: true, response: interaction.response };
    }

    logHashMismatch(state.index, interaction, requestHash, model, messages);
    state.cassette.interactions = state.cassette.interactions.slice(0, state.index);
    return { replayed: false };
  }

  async function handleInteraction(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    realCall: () => Promise<string>,
  ): Promise<string> {
    if (!state.cassette) {
      throw new Error('No cassette loaded. Call loadCassette() first.');
    }

    const requestHash = hashRequest(model, systemPrompt, messages);
    const replayResult = tryReplayInteraction(requestHash, model, messages);

    if (replayResult.replayed) {
      return replayResult.response!;
    }

    if (mode === 'playback') {
      throw new Error(
        `No matching interaction in cassette at index ${state.index}. ` +
          `Run with VCR_MODE=auto or VCR_MODE=record to record new interactions.`,
      );
    }

    console.log(`📼 Recording new interaction ${state.index + 1}`);
    const startTime = Date.now();
    const response = await realCall();
    const responseTimeMs = Date.now() - startTime;

    state.cassette.interactions.push(
      createInteractionRecord(requestHash, model, systemPrompt, messages, response, responseTimeMs),
    );

    state.index++;
    state.modified = true;

    return response;
  }

  function ejectCassette(): void {
    if (state.cassette && state.modified && state.path) {
      saveCassette();
    }
    unfreezeTime();
    state.cassette = null;
    state.path = null;
    state.index = 0;
    state.modified = false;
  }

  function getMode(): RecordMode {
    return mode;
  }

  function isReplaying(): boolean {
    if (!state.cassette) return false;
    return mode !== 'record' && state.cassette.interactions.length > 0;
  }

  return {
    loadCassette,
    handleInteraction,
    ejectCassette,
    saveCassette,
    getMode,
    isReplaying,
  };
}

export type CassetteManager = ReturnType<typeof createCassetteManager>;
