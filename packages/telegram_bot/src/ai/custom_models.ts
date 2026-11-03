import type { Model } from '@earendil-works/pi-ai';
import { stream, streamSimple } from '@earendil-works/pi-ai/api/openai-completions';
import { createProvider, type Models, type Provider } from '@earendil-works/pi-ai/models';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import { map, obj, unknown as unknownSchema } from '@eddo/core-shared/validation/schema_parser';
import { readFileSync } from 'node:fs';

import { resolveCustomApiKey } from './custom_model_auth.js';
import { customProviderSchema, type CustomProviderConfig } from './custom_model_schema.js';

export interface ConfiguredModelsOptions {
  modelName: string;
  configPath?: string;
}

const providerFileSchema = createProjectedParser(obj({ providers: map(unknownSchema()) }));

/** Reads trusted configuration without exposing malformed JSON or credential values in errors. */
function readProviderFile(path: string): Record<string, unknown> {
  try {
    return providerFileSchema.parse(JSON.parse(readFileSync(path, 'utf8'))).providers;
  } catch {
    throw new Error(
      'Cannot read custom models configuration; verify EDDO_MODELS_FILE contains valid provider JSON',
    );
  }
}

/** Loads only the selected model and provider, leaving unrelated private configuration untouched. */
export function loadCustomProvider(
  options: ConfiguredModelsOptions,
): CustomProviderConfig | undefined {
  if (!options.configPath) return undefined;
  const selection = options.modelName.trim();
  const separator = selection.indexOf('/');
  const providers = readProviderFile(options.configPath);
  if (separator < 1) return undefined;
  const selected = providers[selection.slice(0, separator)];
  if (selected === undefined) return undefined;
  const parsed = customProviderSchema.safeParse(selected);
  if (!parsed.success)
    throw new Error(
      'Unsupported custom provider configuration; use OpenAI Chat Completions and documented compatibility fields',
    );
  const model = parsed.data.models.find((item) => item.id === selection.slice(separator + 1));
  if (!model) throw new Error('Selected custom model is absent from models.json');
  return { ...parsed.data, models: [model] };
}

/** Preserves provider defaults and per-model compatibility overrides for native tool streaming. */
function modelDeclarations(
  provider: string,
  config: CustomProviderConfig,
): Model<'openai-completions'>[] {
  return config.models.map((model) => ({
    ...model,
    name: model.name ?? model.id,
    provider,
    api: config.api,
    baseUrl: config.baseUrl,
    compat: { ...config.compat, ...model.compat },
  }));
}

/** Registers native OpenAI-compatible streaming without resolving credentials during model discovery. */
export function createCustomProvider(provider: string, config: CustomProviderConfig): Provider {
  return createProvider({
    id: provider,
    name: config.name,
    baseUrl: config.baseUrl,
    models: modelDeclarations(provider, config),
    auth: {
      apiKey: {
        name: 'Custom model provider',
        resolve: async () => ({ auth: { apiKey: await resolveCustomApiKey(config.apiKey) } }),
      },
    },
    api: { stream, streamSimple },
  });
}

/** Adds an explicitly configured custom model without filesystem writes or VCR dependencies. */
export function configuredModels(options: ConfiguredModelsOptions): Models {
  const models = builtinModels();
  const config = loadCustomProvider(options);
  if (config) {
    const provider = options.modelName.trim().split('/')[0];
    models.setProvider(createCustomProvider(provider, config));
  }
  return models;
}
