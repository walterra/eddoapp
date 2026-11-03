// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  config: { LLM_MODEL: 'qwen38/qwen3.8-27b', EDDO_MODELS_FILE: '', BOT_PERSONA_ID: 'gtd_coach' },
  open: vi.fn().mockResolvedValue({}),
  provision: vi.fn().mockResolvedValue({ url: 'http://unused' }),
}));
vi.mock('../utils/config.js', () => ({ appConfig: fixture.config }));
vi.mock('@eddo/core-server', async (original) => ({
  ...(await original<typeof import('@eddo/core-server')>()),
  createEnv: () => ({ COUCHDB_URL: 'http://unused' }),
  createUserRegistry: () => ({
    findByUsername: async () => ({ username: 'alice', status: 'active', preferences: {} }),
  }),
}));
vi.mock('./account_authorization.js', () => ({
  resolveAssistantAccount: async () => ({ username: 'alice', mcpApiKey: 'mcp-test-key' }),
}));
vi.mock('../mcp/client.js', () => ({
  getMCPClient: () => ({ tools: [] }),
  scopeMCPIntegration: async () => ({ tools: [] }),
}));
vi.mock('pi-durable-couchdb', () => ({ openCouchDbStorage: async () => ({ close: vi.fn() }) }));
vi.mock('./couch.js', () => ({ provisionDurableDatabase: fixture.provision }));
vi.mock('./assistant_runtime.js', () => ({ openAssistantRuntime: fixture.open }));

const directories: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

async function host() {
  const directory = mkdtempSync(join(tmpdir(), 'eddo-custom-host-'));
  directories.push(directory);
  fixture.config.EDDO_MODELS_FILE = join(directory, 'models.json');
  writeFileSync(
    fixture.config.EDDO_MODELS_FILE,
    JSON.stringify({
      providers: {
        qwen38: {
          api: 'openai-completions',
          baseUrl: 'http://gx10.example:30001/v1',
          apiKey: '$HOST_QWEN_KEY',
          compat: {
            supportsDeveloperRole: false,
            requiresReasoningContentOnAssistantMessages: true,
          },
          models: [{ id: 'qwen3.8-27b', reasoning: true, contextWindow: 262144, maxTokens: 64000 }],
        },
      },
    }),
  );
  vi.resetModules();
  return import('./host_runtime.js');
}

describe('custom model Durable host', () => {
  it('validates custom credentials before opening journals', async () => {
    vi.stubEnv('HOST_QWEN_KEY', '');
    const runtime = await host();
    await expect(runtime.validateHostModel()).rejects.toThrow();
    expect(fixture.provision).not.toHaveBeenCalled();
    expect(fixture.open).not.toHaveBeenCalled();
  });

  it('passes the configured model collection into the shared web and Telegram runtime', async () => {
    vi.stubEnv('HOST_QWEN_KEY', 'host-test-key');
    const runtime = await host();
    await runtime.validateHostModel();
    await runtime.openUserRuntime('alice');
    expect(fixture.open).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'alice',
        telegramId: undefined,
        model: { provider: 'qwen38', modelId: 'qwen3.8-27b' },
      }),
    );
    const options = fixture.open.mock.calls[0][0];
    expect(options.models.getModel('qwen38', 'qwen3.8-27b')).toMatchObject({
      api: 'openai-completions',
      compat: { requiresReasoningContentOnAssistantMessages: true },
    });
    expect((await options.models.getAuth('qwen38')).auth.apiKey).toBe('host-test-key');
  });
});
