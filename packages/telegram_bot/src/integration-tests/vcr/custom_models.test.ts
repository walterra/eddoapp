// @vitest-environment node
import { createModels } from '@earendil-works/pi-ai/models';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveConfiguredModel } from '../../ai/llm-model-resolution.js';
import { createCachedProvider } from './cached-provider.js';
import { createCassetteManager } from './cassette-manager.js';
import { recordingModels } from './custom_models.js';

const directories: string[] = [];
const modelName = 'qwen38/qwen3.8-27b';

function fixture(apiKey = '$TEST_QWEN_KEY') {
  const root = mkdtempSync(join(tmpdir(), 'eddo-custom-model-'));
  directories.push(root);
  const configPath = join(root, 'models.json');
  writeFileSync(
    configPath,
    JSON.stringify({
      providers: {
        unrelated: { api: 'unsupported', apiKey: '!must-not-execute' },
        qwen38: {
          api: 'openai-completions',
          baseUrl: 'http://gx10.example:30001/v1',
          apiKey,
          compat: {
            supportsStore: false,
            supportsDeveloperRole: false,
            supportsStrictMode: false,
            supportsReasoningEffort: true,
            supportsUsageInStreaming: true,
            maxTokensField: 'max_tokens',
            thinkingFormat: 'openai',
            requiresReasoningContentOnAssistantMessages: true,
          },
          models: [
            {
              id: 'qwen3.8-27b',
              reasoning: true,
              contextWindow: 262144,
              maxTokens: 64000,
              thinkingLevelMap: { off: null, low: 'low', high: 'xhigh' },
              compat: { supportsStore: true },
            },
          ],
        },
      },
    }),
  );
  return {
    root,
    configPath,
    options: { modelName, configPath, cassettesDir: root, mode: 'record' as const },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

function toolResponse(): Response {
  const chunks = [
    {
      id: 'local-response',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'qwen3.8-27b',
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: 'call-local',
                type: 'function',
                function: { name: 'createTodo', arguments: '{"title":"Local task"}' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    {
      id: 'local-response',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'qwen3.8-27b',
      choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
    },
  ];
  return new Response(
    chunks.map((chunk) => 'data: ' + JSON.stringify(chunk) + '\n\n').join('') + 'data: [DONE]\n\n',
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

describe('custom recording models', () => {
  it('loads only the selected provider and preserves reasoning and compatibility settings', () => {
    const { options } = fixture();
    const models = recordingModels(options);
    expect(resolveConfiguredModel(modelName, models)).toEqual({
      provider: 'qwen38',
      modelId: 'qwen3.8-27b',
    });
    expect(models.getProvider('unrelated')).toBeUndefined();
    expect(models.getModel('qwen38', 'qwen3.8-27b')).toMatchObject({
      api: 'openai-completions',
      baseUrl: 'http://gx10.example:30001/v1',
      contextWindow: 262144,
      maxTokens: 64000,
      reasoning: true,
      thinkingLevelMap: { high: 'xhigh' },
      compat: {
        supportsStore: true,
        supportsDeveloperRole: false,
        requiresReasoningContentOnAssistantMessages: true,
      },
    });
  });

  it('defers credential commands until live authentication', async () => {
    const { root, configPath, options } = fixture();
    const marker = join(root, 'credential-command-ran');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    config.providers.qwen38.apiKey = '!touch "' + marker + '"; printf test-key';
    writeFileSync(configPath, JSON.stringify(config));
    const source = recordingModels(options);
    expect(existsSync(marker)).toBe(false);
    expect((await source.getAuth('qwen38'))?.auth.apiKey).toBe('test-key');
    expect(existsSync(marker)).toBe(true);
  });

  it('writes a credential-free portable sidecar and ignores personal config during playback', () => {
    const { root, configPath, options } = fixture('!printf PRIVATE_CREDENTIAL');
    recordingModels(options);
    const sidecar = readFileSync(join(root, 'qwen38_qwen3_8-27b', '.model-config'), 'utf8');
    expect(sidecar).not.toContain('PRIVATE_CREDENTIAL');
    expect(sidecar).not.toContain('apiKey');
    expect(sidecar).not.toContain('unrelated');
    rmSync(configPath);
    const replay = recordingModels({ ...options, mode: 'playback' });
    expect(replay.getModel('qwen38', 'qwen3.8-27b')?.api).toBe('openai-completions');
    expect(readFileSync(join(root, 'qwen38_qwen3_8-27b', '.model-config'), 'utf8')).toBe(sidecar);
  });

  it('records native tool calls through the compatible endpoint and replays without credentials or network', async () => {
    const { root, configPath, options } = fixture();
    vi.stubEnv('TEST_QWEN_KEY', 'local-test-key');
    const fetch = vi.fn().mockResolvedValue(toolResponse());
    vi.stubGlobal('fetch', fetch);
    const source = recordingModels(options);
    const model = source.getModel('qwen38', 'qwen3.8-27b')!;
    const record = createCassetteManager({
      cassettesDir: root,
      namespace: modelName,
      mode: 'record',
    });
    await record.loadCassette('native');
    const wrapped = createModels();
    wrapped.setProvider(
      createCachedProvider({
        source,
        provider: source.getProvider('qwen38')!,
        cassetteManager: record,
      }),
    );
    const input = { messages: [{ role: 'user' as const, content: 'Save a task', timestamp: 1 }] };
    const result = await wrapped
      .streamSimple(model, input, { maxTokens: 512, reasoning: 'low' })
      .result();
    expect(result.stopReason, result.errorMessage).toBe('toolUse');
    expect(result.content).toContainEqual(
      expect.objectContaining({
        type: 'toolCall',
        name: 'createTodo',
        arguments: { title: 'Local task' },
      }),
    );
    const [url, init] = fetch.mock.calls[0];
    const request = new Request(url, init);
    expect(request.url).toBe('http://gx10.example:30001/v1/chat/completions');
    expect(request.headers.get('authorization')).toBe('Bearer local-test-key');
    expect(await request.json()).toMatchObject({
      model: 'qwen3.8-27b',
      max_tokens: 512,
      reasoning_effort: 'low',
    });
    await record.ejectCassette();
    rmSync(configPath);
    vi.stubEnv('TEST_QWEN_KEY', '');
    fetch.mockClear();
    const playbackSource = recordingModels({ ...options, mode: 'playback' });
    const auth = vi.spyOn(playbackSource, 'getAuth');
    const replay = createCassetteManager({
      cassettesDir: root,
      namespace: modelName,
      mode: 'playback',
    });
    await replay.loadCassette('native');
    const playback = createModels();
    playback.setProvider(
      createCachedProvider({
        source: playbackSource,
        provider: playbackSource.getProvider('qwen38')!,
        cassetteManager: replay,
      }),
    );
    const played = await playback
      .streamSimple(model, input, { maxTokens: 512, reasoning: 'low' })
      .result();
    expect(played.content).toEqual(result.content);
    expect(fetch).not.toHaveBeenCalled();
    expect(auth).not.toHaveBeenCalled();
    replay.assertConsumed();
    await replay.ejectCassette();
  });

  it('rejects unsupported provider configuration without including secret values', () => {
    const { options, configPath } = fixture();
    writeFileSync(
      configPath,
      JSON.stringify({
        providers: {
          qwen38: {
            api: 'unsupported',
            apiKey: 'secret-value',
          },
        },
      }),
    );
    expect(() => recordingModels(options)).toThrow('Unsupported custom provider configuration');
    try {
      recordingModels(options);
    } catch (error) {
      expect(String(error)).not.toContain('secret-value');
    }
  });

  it('keeps built-in models available without custom configuration', () => {
    const { options } = fixture();
    const models = recordingModels({
      ...options,
      modelName: 'openai/gpt-5.2',
      configPath: undefined,
    });
    expect(models.getModel('openai', 'gpt-5.2')).toBeDefined();
  });

  it('rejects a sidecar whose selected model does not match', () => {
    const { root, options } = fixture();
    recordingModels(options);
    const path = join(root, 'qwen38_qwen3_8-27b', '.model-config');
    const data = JSON.parse(readFileSync(path, 'utf8'));
    data.config.models[0].id = 'wrong-model';
    writeFileSync(path, JSON.stringify(data));
    expect(() => recordingModels({ ...options, mode: 'playback' })).toThrow('does not match');
  });
});
