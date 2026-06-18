import type { Api, Model, SimpleStreamOptions, ThinkingLevel } from '@earendil-works/pi-ai';

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_REASONING: ThinkingLevel = 'low';
const REASONING_LEVELS: readonly ThinkingLevel[] = ['minimal', 'low', 'medium', 'high', 'xhigh'];

/** Parses positive integer env values. */
function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;

  return parsed;
}

/** Parses pi-ai reasoning effort env value. */
function parseReasoning(value: string | undefined): ThinkingLevel {
  if (!value) return DEFAULT_REASONING;

  const normalized = value.trim().toLowerCase();
  const reasoning = REASONING_LEVELS.find((level) => level === normalized);
  return reasoning ?? DEFAULT_REASONING;
}

/** Returns model-aware max tokens for pi-ai simple calls. */
export function getLlmMaxTokens(model: Model<Api>): number {
  const configured = parsePositiveInteger(process.env.LLM_MAX_TOKENS);
  const requested = configured ?? DEFAULT_MAX_TOKENS;
  return Math.min(requested, model.maxTokens);
}

/** Builds pi-ai simple call options for chat agent requests. */
export function createLlmOptions(model: Model<Api>, apiKey: string): SimpleStreamOptions {
  const options: SimpleStreamOptions = {
    apiKey,
    maxTokens: getLlmMaxTokens(model),
  };

  if (model.reasoning) {
    options.reasoning = parseReasoning(process.env.LLM_REASONING_EFFORT);
  }

  return options;
}
