import type { Models } from '@earendil-works/pi-ai/models';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CustomProviderConfig } from '../../ai/custom_model_schema.js';
import { createCustomProvider, loadCustomProvider } from '../../ai/custom_models.js';

import { getCassettePath } from './cassette-helpers.js';
import type { RecordMode } from './cassette-types.js';
import { portableModelSchema, type PortableModelConfig } from './custom_model_schema.js';

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

/** Registers custom recording models while keeping playback independent of keys and local files. */
export function recordingModels(options: RecordingModelsOptions): Models {
  const models = builtinModels();
  const path = portablePath(options);
  const config = options.mode === 'playback' ? undefined : loadCustomProvider(options);
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
    createCustomProvider(portable.provider, { ...portable.config, apiKey: config?.apiKey }),
  );
  if (config) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(portable, null, 2) + '\n');
  }
  return models;
}
