// @vitest-environment node
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuredModels } from './custom_models.js';
import { resolveConfiguredModel } from './llm-model-resolution.js';

const directories: string[] = [];

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'eddo-production-model-'));
  directories.push(directory);
  const path = join(directory, 'models.json');
  writeFileSync(
    path,
    JSON.stringify({
      providers: {
        qwen38: {
          api: 'openai-completions',
          baseUrl: 'http://gx10.example:30001/v1',
          apiKey: '$QWEN_TEST_KEY',
          compat: {
            supportsDeveloperRole: false,
            maxTokensField: 'max_tokens',
            requiresReasoningContentOnAssistantMessages: true,
          },
          models: [
            {
              id: 'qwen3.8-27b',
              reasoning: true,
              contextWindow: 262144,
              maxTokens: 64000,
              thinkingLevelMap: { low: 'low', high: 'xhigh' },
            },
          ],
        },
        unrelated: { api: 'unsupported', apiKey: '!must-not-execute' },
      },
    }),
  );
  return path;
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('production custom models', () => {
  it('loads the selected provider without writing sidecars or resolving credentials during discovery', async () => {
    const configPath = fixture();
    const models = configuredModels({ configPath, modelName: ' qwen38/qwen3.8-27b ' });
    expect(resolveConfiguredModel('qwen38/qwen3.8-27b', models)).toEqual({
      provider: 'qwen38',
      modelId: 'qwen3.8-27b',
    });
    expect(models.getProvider('unrelated')).toBeUndefined();
    expect(readdirSync(directories[0])).toEqual(['models.json']);
    expect(models.getModel('qwen38', 'qwen3.8-27b')).toMatchObject({
      contextWindow: 262144,
      maxTokens: 64000,
      reasoning: true,
      compat: { supportsDeveloperRole: false, requiresReasoningContentOnAssistantMessages: true },
      thinkingLevelMap: { high: 'xhigh' },
    });
    vi.stubEnv('QWEN_TEST_KEY', 'production-test-key');
    expect((await models.getAuth('qwen38'))?.auth.apiKey).toBe('production-test-key');
    vi.stubEnv('QWEN_TEST_KEY', 'rotated-test-key');
    expect((await models.getAuth('qwen38'))?.auth.apiKey).toBe('rotated-test-key');
  });

  it('keeps built-in providers when custom configuration is absent', () => {
    const models = configuredModels({ modelName: 'anthropic/claude-sonnet-4-5-20250929' });
    expect(models.getModel('anthropic', 'claude-sonnet-4-5-20250929')).toBeDefined();
  });

  it('does not guess missing models', () => {
    expect(() => configuredModels({ configPath: fixture(), modelName: 'qwen38/missing' })).toThrow(
      'Selected custom model is absent',
    );
  });

  it('sanitizes malformed configuration errors', () => {
    const configPath = fixture();
    writeFileSync(configPath, '{"apiKey":"SECRET" invalid');
    expect(() => configuredModels({ configPath, modelName: 'qwen38/qwen3.8-27b' })).toThrow(
      'Cannot read custom models configuration',
    );
    try {
      configuredModels({ configPath, modelName: 'qwen38/qwen3.8-27b' });
    } catch (error) {
      expect(String(error)).not.toContain('SECRET');
    }
  });
});
