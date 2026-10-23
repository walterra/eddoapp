import type { Models } from '@earendil-works/pi-ai';
import type { ModelRef } from '@earendil-works/pi-durable';

/** Resolves LLM_MODEL using the registered catalog without guessing custom model metadata. */
export function resolveConfiguredModel(configuredModel: string, models: Models): ModelRef {
  const value = configuredModel.trim();
  if (!value) throw new Error('LLM_MODEL must contain a model ID');
  const separator = value.indexOf('/');
  const provider = value.slice(0, separator);
  if (separator > 0 && models.getProvider(provider)) {
    const modelId = value.slice(separator + 1);
    if (!models.getModel(provider, modelId)) throw new Error(`Unknown LLM_MODEL: ${value}`);
    return { provider, modelId };
  }
  if (value.startsWith('claude-') && models.getModel('anthropic', value)) {
    return { provider: 'anthropic', modelId: value };
  }
  const matches = models.getModels().filter((model) => model.id === value);
  if (matches.length === 1) return { provider: matches[0].provider, modelId: value };
  if (matches.length > 1)
    throw new Error(`Ambiguous LLM_MODEL "${value}"; use provider/model format`);
  throw new Error(`Unknown LLM_MODEL "${value}"; use a registered model or provider/model ID`);
}
