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
export interface CassetteState {
  cassette: Cassette | null;
  path: string | null;
  index: number;
  modified: boolean;
  timeFrozen: boolean;
}

/** Message type for interactions */
export type Message = { role: string; content: string };

/** Parameters for handling an interaction */
export interface InteractionParams {
  model: string;
  systemPrompt: string;
  messages: Message[];
  realCall: () => Promise<string>;
}

/** Context for replay operations */
export interface ReplayContext {
  state: CassetteState;
  mode: RecordMode;
  requestHash: string;
  model: string;
  messages: Message[];
}

/** Record operation parameters */
export interface RecordParams {
  state: CassetteState;
  requestHash: string;
  model: string;
  systemPrompt: string;
  messages: Message[];
  realCall: () => Promise<string>;
}
