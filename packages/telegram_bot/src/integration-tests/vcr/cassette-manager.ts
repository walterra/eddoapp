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
import type {
  Cassette,
  CassetteManagerConfig,
  CassetteState,
  InteractionParams,
  LLMInteraction,
  Message,
  RecordMode,
  RecordParams,
  ReplayContext,
  TimeController,
} from './cassette-types.js';

export type { Cassette, CassetteManagerConfig, LLMInteraction, RecordMode, TimeController };

/** Time controller helpers */
interface TimeHelpers {
  freeze: (isoTime: string) => void;
  unfreeze: () => void;
  isFrozen: () => boolean;
}

/** Create time controller helpers */
function createTimeHelpers(timeController?: TimeController): TimeHelpers {
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

/** Cassette context for operations */
interface CassetteContext {
  state: CassetteState;
  mode: RecordMode;
  cassettesDir: string;
  time: TimeHelpers;
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

/** Handle interaction: replay or record */
async function handleInteractionImpl(
  ctx: CassetteContext,
  params: InteractionParams,
): Promise<string> {
  const { state, mode } = ctx;
  const { model, systemPrompt, messages, realCall } = params;
  if (!state.cassette) throw new Error('No cassette loaded. Call loadCassette() first.');
  const requestHash = hashRequest(model, systemPrompt, messages);
  const replayResult = tryReplayFromCassette({ state, mode, requestHash, model, messages });
  if (replayResult.replayed) return replayResult.response!;
  if (mode === 'playback') {
    throw new Error(
      `No matching interaction in cassette at index ${state.index}. Run with VCR_MODE=auto or VCR_MODE=record to record new interactions.`,
    );
  }
  return recordNewInteraction({ state, requestHash, model, systemPrompt, messages, realCall });
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

  return {
    loadCassette: (testName: string) => doLoadCassette(ctx, testName),
    handleInteraction: (m: string, s: string, msgs: Message[], r: () => Promise<string>) =>
      handleInteractionImpl(ctx, { model: m, systemPrompt: s, messages: msgs, realCall: r }),
    ejectCassette: (): void => {
      if (state.cassette && state.modified && state.path) saveCassette();
      time.unfreeze();
      Object.assign(state, { cassette: null, path: null, index: 0, modified: false });
    },
    saveCassette,
    getMode: () => mode,
    isReplaying: () =>
      !!state.cassette && mode !== 'record' && state.cassette.interactions.length > 0,
  };
}

export type CassetteManager = ReturnType<typeof createCassetteManager>;
