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

/** Create time controller helpers */
function createTimeHelpers(timeController?: TimeController) {
  let timeFrozen = false;
  return {
    freeze: (isoTime: string) => {
      if (timeController && isoTime) {
        if (process.env.VCR_DEBUG) console.log(`📼 Freezing time to: ${isoTime}`);
        timeController.freeze(isoTime);
        timeFrozen = true;
      }
    },
    unfreeze: () => {
      if (timeFrozen && timeController) {
        timeController.unfreeze();
        timeFrozen = false;
      }
    },
    isFrozen: () => timeFrozen,
  };
}

interface ReplayContext {
  state: CassetteState;
  mode: RecordMode;
  requestHash: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
}

/** Try to replay an interaction from the cassette */
function tryReplayFromCassette(ctx: ReplayContext): { replayed: boolean; response?: string } {
  const { state, mode, requestHash, model, messages } = ctx;
  if (!state.cassette || mode === 'record') return { replayed: false };
  if (state.index >= state.cassette.interactions.length) return { replayed: false };

  const interaction = state.cassette.interactions[state.index];
  if (interaction.requestHash === requestHash) {
    state.index++;
    if (process.env.VCR_DEBUG) {
      console.log(`📼 Replaying interaction ${state.index}/${state.cassette.interactions.length}`);
    }
    return { replayed: true, response: interaction.response };
  }

  logHashMismatch({
    index: state.index,
    expected: interaction,
    actualHash: requestHash,
    model,
    messages,
  });
  state.cassette.interactions = state.cassette.interactions.slice(0, state.index);
  return { replayed: false };
}

interface CassetteContext {
  state: CassetteState;
  mode: RecordMode;
  cassettesDir: string;
  time: ReturnType<typeof createTimeHelpers>;
  saveCassette: () => void;
}

/** Load or create cassette for test */
function doLoadCassette(ctx: CassetteContext, testName: string): void {
  const { state, mode, cassettesDir, time, saveCassette } = ctx;
  if (state.cassette && state.modified && state.path) saveCassette();
  time.unfreeze();

  state.path = getCassettePath(cassettesDir, testName);
  state.index = 0;
  state.modified = false;
  const safeName = testName.replace(/[^a-zA-Z0-9-_]/g, '_');

  if (existsSync(state.path) && mode !== 'record') {
    state.cassette = loadCassetteFromFile(state.path);
    if (process.env.VCR_DEBUG)
      console.log(
        `📼 Loaded cassette: ${safeName} (${state.cassette.interactions.length} interactions)`,
      );
    time.freeze(state.cassette.frozenTime);
  } else {
    state.cassette = createNewCassette(testName);
    if (mode === 'playback') throw new Error(`Cassette not found for playback: ${state.path}`);
    if (process.env.VCR_DEBUG) console.log(`📼 Created new cassette: ${safeName}`);
  }
}

interface RecordParams {
  state: CassetteState;
  requestHash: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  realCall: () => Promise<string>;
}

/** Record new interaction */
async function recordNewInteraction(params: RecordParams): Promise<string> {
  const { state, requestHash, model, systemPrompt, messages, realCall } = params;
  console.log(`📼 Recording new interaction ${state.index + 1}`);
  const startTime = Date.now();
  const response = await realCall();
  state.cassette!.interactions.push(
    createInteractionRecord({
      requestHash,
      model,
      systemPrompt,
      messages,
      response,
      responseTimeMs: Date.now() - startTime,
    }),
  );
  state.index++;
  state.modified = true;
  return response;
}

/** Factory function to create a cassette manager */
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
  const time = createTimeHelpers(timeController);

  if (!existsSync(cassettesDir)) mkdirSync(cassettesDir, { recursive: true });

  const saveCassette = (): void => {
    if (!state.cassette || !state.path) return;
    saveCassetteToFile(state.path, state.cassette);
    state.modified = false;
  };

  const ctx: CassetteContext = { state, mode, cassettesDir, time, saveCassette };

  async function handleInteraction(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    realCall: () => Promise<string>,
  ): Promise<string> {
    if (!state.cassette) throw new Error('No cassette loaded. Call loadCassette() first.');
    const requestHash = hashRequest(model, systemPrompt, messages);
    const replayResult = tryReplayFromCassette({ state, mode, requestHash, model, messages });
    if (replayResult.replayed) return replayResult.response!;
    if (mode === 'playback')
      throw new Error(
        `No matching interaction in cassette at index ${state.index}. Run with VCR_MODE=auto or VCR_MODE=record to record new interactions.`,
      );
    return recordNewInteraction({ state, requestHash, model, systemPrompt, messages, realCall });
  }

  function ejectCassette(): void {
    if (state.cassette && state.modified && state.path) saveCassette();
    time.unfreeze();
    Object.assign(state, { cassette: null, path: null, index: 0, modified: false });
  }

  return {
    loadCassette: (testName: string) => doLoadCassette(ctx, testName),
    handleInteraction,
    ejectCassette,
    saveCassette,
    getMode: () => mode,
    isReplaying: () =>
      !!state.cassette && mode !== 'record' && state.cassette.interactions.length > 0,
  };
}

export type CassetteManager = ReturnType<typeof createCassetteManager>;
