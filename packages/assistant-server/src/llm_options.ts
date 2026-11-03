import type {
  Api,
  Model,
  ModelThinkingLevel,
  ModelsSimpleStreamOptions,
} from '@earendil-works/pi-ai';
import {
  createSchemaParser,
  int,
  obj,
  oneOf,
  str,
} from '@eddo/core-shared/validation/schema_parser';

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_REASONING: ModelThinkingLevel = 'low';
const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

const generationSchema = createSchemaParser(
  obj({
    LLM_MAX_TOKENS: str({ pattern: '^[1-9]\\d*$' }),
    LLM_REASONING_EFFORT: oneOf(REASONING_LEVELS),
  }),
);
const tokenLimit = createSchemaParser(int({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }));

export interface LlmGenerationSettings {
  maxTokens: number;
  thinkingLevel: ModelThinkingLevel;
}

/** Validates generation controls once per runtime instead of silently ignoring invalid settings. */
export function parseLlmSettings(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): LlmGenerationSettings {
  const parsed = generationSchema.parse({
    LLM_MAX_TOKENS: (environment.LLM_MAX_TOKENS ?? String(DEFAULT_MAX_TOKENS)).trim(),
    LLM_REASONING_EFFORT: (environment.LLM_REASONING_EFFORT ?? DEFAULT_REASONING)
      .trim()
      .toLowerCase(),
  });
  return {
    maxTokens: tokenLimit.parse(Number(parsed.LLM_MAX_TOKENS)),
    thinkingLevel: parsed.LLM_REASONING_EFFORT,
  };
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
    cacheRetention: options.cacheRetention ?? 'long',
    maxTokens: Math.min(settings.maxTokens, model.maxTokens, options.maxTokens ?? Infinity),
    ...(model.reasoning ? {} : { reasoning: undefined }),
  };
}
