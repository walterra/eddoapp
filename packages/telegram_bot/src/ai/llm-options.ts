import type {
  Api,
  Model,
  ModelThinkingLevel,
  ModelsSimpleStreamOptions,
} from '@earendil-works/pi-ai';
import { z } from 'zod';

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_REASONING: ModelThinkingLevel = 'low';
const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

const generationSchema = z.object({
  LLM_MAX_TOKENS: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, 'LLM_MAX_TOKENS must be a positive integer')
    .default(String(DEFAULT_MAX_TOKENS))
    .transform(Number)
    .pipe(z.number().int().positive()),
  LLM_REASONING_EFFORT: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(REASONING_LEVELS))
    .default(DEFAULT_REASONING),
});

export interface LlmGenerationSettings {
  maxTokens: number;
  thinkingLevel: ModelThinkingLevel;
}

/** Validates generation controls once per runtime instead of silently ignoring invalid settings. */
export function parseLlmSettings(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): LlmGenerationSettings {
  const parsed = generationSchema.parse(environment);
  return { maxTokens: parsed.LLM_MAX_TOKENS, thinkingLevel: parsed.LLM_REASONING_EFFORT };
}

/** Disables reasoning for models that do not advertise support. */
export function modelThinkingLevel(
  model: Model<Api>,
  settings: LlmGenerationSettings,
): ModelThinkingLevel {
  return model.reasoning ? settings.thinkingLevel : 'off';
}

/** Caps generation and compaction requests without increasing a tighter Harness-supplied limit. */
export function boundedLlmOptions(
  model: Model<Api>,
  settings: LlmGenerationSettings,
  options: ModelsSimpleStreamOptions = {},
): ModelsSimpleStreamOptions {
  return {
    ...options,
    maxTokens: Math.min(settings.maxTokens, model.maxTokens, options.maxTokens ?? Infinity),
    ...(model.reasoning ? {} : { reasoning: undefined }),
  };
}
