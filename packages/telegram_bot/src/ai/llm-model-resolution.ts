import {
  getModels,
  getProviders,
  type Api,
  type KnownProvider,
  type Model,
} from '@earendil-works/pi-ai';

const MODEL_PROVIDER_SEPARATOR = '/';
const ANTHROPIC_PROVIDER: KnownProvider = 'anthropic';
const ANTHROPIC_MODEL_PREFIX = 'claude-';

interface ParsedModelSelection {
  provider?: KnownProvider;
  modelId: string;
}

interface ProviderModelMatch {
  provider: KnownProvider;
  model: Model<Api>;
}

export interface ResolvedModelSelection {
  model: Model<Api>;
  provider: KnownProvider;
  modelId: string;
}

/** Parses configured model and optional provider prefix. */
function parseModelSelection(configuredModel: string): ParsedModelSelection {
  const value = configuredModel.trim();
  if (!value) {
    throw new Error('LLM model id is required');
  }

  const slashIndex = value.indexOf(MODEL_PROVIDER_SEPARATOR);
  if (slashIndex <= 0) {
    return { modelId: value };
  }

  const providerCandidate = value.slice(0, slashIndex);
  const modelIdCandidate = value.slice(slashIndex + 1).trim();
  const provider = getProviders().find((item) => item === providerCandidate);

  if (!provider) {
    return { modelId: value };
  }

  if (!modelIdCandidate) {
    throw new Error(`Model id is missing after provider prefix "${provider}"`);
  }

  return {
    provider,
    modelId: modelIdCandidate,
  };
}

/** Returns exact model matches by id across all providers. */
function findModelMatches(modelId: string): ProviderModelMatch[] {
  return getProviders().flatMap((provider) => {
    const model = getModels(provider).find((item) => item.id === modelId);
    return model ? [{ provider, model: model as Model<Api> }] : [];
  });
}

/** Builds provider-scoped fallback model for unknown ids. */
function buildProviderFallbackModel(provider: KnownProvider, modelId: string): Model<Api> {
  const providerModels = getModels(provider);
  if (providerModels.length === 0) {
    throw new Error(`Provider "${provider}" has no registered models`);
  }

  const baseModel = providerModels[0] as Model<Api>;
  return {
    ...baseModel,
    id: modelId,
    name: modelId,
  };
}

/** Resolves configured model id to concrete model metadata and provider. */
export function resolveConfiguredModel(configuredModel: string): ResolvedModelSelection {
  const parsed = parseModelSelection(configuredModel);

  if (parsed.provider) {
    const exactModel = getModels(parsed.provider).find((item) => item.id === parsed.modelId);
    const model = exactModel
      ? (exactModel as Model<Api>)
      : buildProviderFallbackModel(parsed.provider, parsed.modelId);

    return {
      model,
      provider: parsed.provider,
      modelId: parsed.modelId,
    };
  }

  const matches = findModelMatches(parsed.modelId);
  if (matches.length === 1) {
    const match = matches[0];
    return {
      model: match.model,
      provider: match.provider,
      modelId: parsed.modelId,
    };
  }

  if (matches.length > 1) {
    const options = matches.map((item) => `${item.provider}/${item.model.id}`).join(', ');
    throw new Error(
      `Model id "${parsed.modelId}" is ambiguous. Use provider prefix (for example "openai/${parsed.modelId}"). Matches: ${options}`,
    );
  }

  if (parsed.modelId.startsWith(ANTHROPIC_MODEL_PREFIX)) {
    return {
      model: buildProviderFallbackModel(ANTHROPIC_PROVIDER, parsed.modelId),
      provider: ANTHROPIC_PROVIDER,
      modelId: parsed.modelId,
    };
  }

  throw new Error(
    `Model id "${parsed.modelId}" is not registered. Use "provider/model" format for custom model ids.`,
  );
}
