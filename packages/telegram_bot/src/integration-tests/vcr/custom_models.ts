import type { Model } from '@earendil-works/pi-ai';
import { stream, streamSimple } from '@earendil-works/pi-ai/api/openai-completions';
import { createProvider, type Models } from '@earendil-works/pi-ai/models';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

import { getCassettePath } from './cassette-helpers.js';
import type { RecordMode } from './cassette-types.js';
import { resolveCustomApiKey } from './custom_model_auth.js';
import {
  customProviderSchema,
  portableModelSchema,
  type CustomProviderConfig,
  type PortableModelConfig,
} from './custom_model_schema.js';

interface RecordingModelsOptions {
  modelName: string;
  cassettesDir: string;
  mode: RecordMode;
  configPath?: string;
}

/** Locates a portable sidecar without changing cassette discovery or evaluation. */
function portablePath(options: RecordingModelsOptions): string {
  return join(
    dirname(
      getCassettePath({
        cassettesDir: options.cassettesDir,
        namespace: options.modelName,
        testName: 'unused',
      }),
    ),
    '.model-config',
  );
}

/** Loads only the explicitly selected provider, ignoring unrelated personal configuration. */
function selectedConfig(options: RecordingModelsOptions): CustomProviderConfig | undefined {
  if (!options.configPath) return undefined;
  const file = z
    .object({ providers: z.record(z.string(), z.unknown()) })
    .parse(JSON.parse(readFileSync(options.configPath, 'utf8')));
  const provider = options.modelName.slice(0, options.modelName.indexOf('/'));
  const selected = file.providers[provider];
  if (!selected) return undefined;
  const result = customProviderSchema.safeParse(selected);
  if (!result.success)
    throw new Error(
      'Unsupported custom provider configuration; use OpenAI Chat Completions and documented compatibility fields',
    );
  return result.data;
}

/** Removes credentials and unrelated models before publishing portable metadata. */
function portableConfig(
  options: RecordingModelsOptions,
  config: CustomProviderConfig,
): PortableModelConfig {
  const separator = options.modelName.indexOf('/');
  const provider = options.modelName.slice(0, separator);
  const modelId = options.modelName.slice(separator + 1);
  const model = config.models.find((item) => item.id === modelId);
  if (!model) throw new Error('Selected custom model is absent from models.json');
  const { apiKey: _apiKey, ...publicConfig } = config;
  return portableModelSchema.parse({
    version: 1,
    provider,
    config: { ...publicConfig, models: [model] },
  });
}

/** Builds native Pi API models with provider and model compatibility settings preserved. */
function modelDeclarations(portable: PortableModelConfig): Model<'openai-completions'>[] {
  return portable.config.models.map((model) => ({
    ...model,
    name: model.name ?? model.id,
    provider: portable.provider,
    api: portable.config.api,
    baseUrl: portable.config.baseUrl,
    compat: { ...portable.config.compat, ...model.compat },
  }));
}

/** Registers custom recording models while keeping playback independent of keys and local files. */
export function recordingModels(options: RecordingModelsOptions): Models {
  const models = builtinModels();
  const path = portablePath(options);
  const config = options.mode === 'playback' ? undefined : selectedConfig(options);
  const portable = config
    ? portableConfig(options, config)
    : existsSync(path)
      ? portableModelSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      : undefined;
  if (!portable) return models;
  const expected = portable.provider + '/' + portable.config.models[0].id;
  if (expected !== options.modelName || portable.config.models.length !== 1)
    throw new Error('Portable model configuration does not match the selected model');
  models.setProvider(
    createProvider({
      id: portable.provider,
      name: portable.config.name,
      baseUrl: portable.config.baseUrl,
      models: modelDeclarations(portable),
      auth: {
        apiKey: {
          name: 'Custom recording provider',
          resolve: async () => ({ auth: { apiKey: await resolveCustomApiKey(config?.apiKey) } }),
        },
      },
      api: { stream, streamSimple },
    }),
  );
  if (config) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(portable, null, 2) + '\n');
  }
  return models;
}
