import { createModels } from '@earendil-works/pi-ai/models';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDurableRuntime } from '../../durable/runtime.js';
import { createRuntimeFixture, createTestInput } from '../../durable/test_helpers.js';
import { createCachedProvider } from './cached-provider.js';
import { getCassettePath } from './cassette-helpers.js';
import { createCassetteManager } from './cassette-manager.js';

vi.mock('../../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi
    .fn()
    .mockResolvedValue({ username: 'alice', preferences: { mcpApiKey: 'test-key' } }),
}));
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function directory(): string {
  const path = mkdtempSync(join(tmpdir(), 'durable-vcr-'));
  directories.push(path);
  return path;
}
function manager(path: string, mode: 'record' | 'playback') {
  return createCassetteManager({ cassettesDir: path, namespace: 'native-test', mode });
}
function fixture(cassettes: ReturnType<typeof manager>) {
  const provider = fauxProvider({ models: [{ id: 'native-test', reasoning: true }] });
  const source = createModels();
  source.setProvider(provider.provider);
  const models = createModels();
  models.setProvider(
    createCachedProvider({ source, provider: provider.provider, cassetteManager: cassettes }),
  );
  return { provider, source, models, model: provider.getModel() };
}
const input = {
  messages: [{ role: 'user' as const, content: 'Create a shopping todo', timestamp: 1 }],
};

describe('native provider VCR boundary', () => {
  it('records and replays complete native tool calls without accessing the source model', async () => {
    const path = directory();
    const record = manager(path, 'record');
    record.loadCassette('native-tool');
    const first = fixture(record);
    first.provider.setResponses([
      fauxAssistantMessage(
        fauxToolCall(
          'createTodo',
          { title: 'Shopping', tags: ['gtd:next'] },
          { id: 'native-call-1' },
        ),
        { stopReason: 'toolUse' },
      ),
    ]);
    const recorded = await first.models.streamSimple(first.model, input).result();
    record.ejectCassette();
    const replay = manager(path, 'playback');
    replay.loadCassette('native-tool');
    const second = fixture(replay);
    const source = vi.spyOn(second.source, 'streamSimple').mockImplementation(() => {
      throw new Error('Network must not run in playback');
    });
    const credentials = vi.spyOn(second.source, 'getAuth');
    const played = await second.models
      .streamSimple(second.model, { messages: [{ ...input.messages[0], timestamp: 999 }] })
      .result();
    expect(played.content).toEqual(recorded.content);
    expect(played.stopReason).toBe('toolUse');
    expect(source).not.toHaveBeenCalled();
    expect(credentials).not.toHaveBeenCalled();
    replay.assertConsumed();
    replay.ejectCassette();
  });

  it('fails closed on a mismatched request and leaves the cassette file unchanged', async () => {
    const path = directory();
    const record = manager(path, 'record');
    record.loadCassette('mismatch');
    const first = fixture(record);
    first.provider.setResponses([fauxAssistantMessage('Recorded answer')]);
    await first.models.streamSimple(first.model, input).result();
    record.ejectCassette();
    const filename = getCassettePath({
      cassettesDir: path,
      namespace: 'native-test',
      testName: 'mismatch',
    });
    const before = readFileSync(filename, 'utf8');
    const replay = manager(path, 'playback');
    replay.loadCassette('mismatch');
    const second = fixture(replay);
    const source = vi.spyOn(second.source, 'streamSimple');
    const result = await second.models
      .streamSimple(second.model, {
        messages: [{ ...input.messages[0], content: 'Different user intent' }],
      })
      .result();
    expect(result.stopReason).toBe('error');
    expect(result.errorMessage).toContain('No matching interaction');
    expect(source).not.toHaveBeenCalled();
    expect(() => replay.assertConsumed()).toThrow('Unconsumed');
    replay.ejectCassette();
    expect(readFileSync(filename, 'utf8')).toBe(before);
  });

  it.each([
    {
      name: 'token limit',
      recorded: { maxTokens: 512, reasoning: 'low' as const },
      replayed: { maxTokens: 1024, reasoning: 'low' as const },
    },
    {
      name: 'reasoning effort',
      recorded: { maxTokens: 512, reasoning: 'low' as const },
      replayed: { maxTokens: 512, reasoning: 'high' as const },
    },
  ])('rejects a recording made with a different $name', async ({ recorded, replayed }) => {
    const path = directory();
    const record = manager(path, 'record');
    record.loadCassette('generation-options');
    const first = fixture(record);
    first.provider.setResponses([fauxAssistantMessage('Recorded')]);
    await first.models.streamSimple(first.model, input, recorded).result();
    record.ejectCassette();
    const replay = manager(path, 'playback');
    replay.loadCassette('generation-options');
    const second = fixture(replay);
    const source = vi.spyOn(second.source, 'streamSimple');
    const result = await second.models.streamSimple(second.model, input, replayed).result();
    expect(result.stopReason).toBe('error');
    expect(result.errorMessage).toContain('No matching interaction');
    expect(source).not.toHaveBeenCalled();
    replay.ejectCassette();
  });

  it('does not silently create missing playback recordings', () => {
    const path = directory();
    const replay = manager(path, 'playback');
    expect(() => replay.loadCassette('missing')).toThrow('Cassette not found');
    replay.ejectCassette();
    expect(
      existsSync(
        getCassettePath({ cassettesDir: path, namespace: 'native-test', testName: 'missing' }),
      ),
    ).toBe(false);
  });

  it('rejects old text-protocol responses instead of converting them into native tool calls', async () => {
    const path = directory();
    const record = manager(path, 'record');
    record.loadCassette('old-format');
    const first = fixture(record);
    first.provider.setResponses([fauxAssistantMessage('Native')]);
    await first.models.streamSimple(first.model, input).result();
    record.ejectCassette();
    const filename = getCassettePath({
      cassettesDir: path,
      namespace: 'native-test',
      testName: 'old-format',
    });
    const cassette = JSON.parse(readFileSync(filename, 'utf8'));
    cassette.interactions[0].response = 'TOOL_CALL: {"name":"createTodo"}';
    writeFileSync(filename, JSON.stringify(cassette));
    const replay = manager(path, 'playback');
    replay.loadCassette('old-format');
    const second = fixture(replay);
    const result = await second.models.streamSimple(second.model, input).result();
    expect(result.stopReason).toBe('error');
    expect(result.errorMessage).toContain('re-record');
    replay.ejectCassette();
  });

  it('runs the actual Durable Harness through record and playback with native tools', async () => {
    const path = directory();
    const run = async (mode: 'record' | 'playback'): Promise<void> => {
      const cassettes = manager(path, mode);
      cassettes.loadCassette('harness');
      const runtimeFixture = await createRuntimeFixture();
      runtimeFixture.options.client.tools = [
        {
          name: 'getTodo',
          description: 'Get a todo',
          inputSchema: { type: 'object', properties: {} },
        },
      ];
      runtimeFixture.options.client.invoke = vi
        .fn()
        .mockResolvedValue([{ type: 'text', text: '{"title":"Shopping"}' }]);
      runtimeFixture.provider.setResponses([
        fauxAssistantMessage(fauxToolCall('getTodo', {}), { stopReason: 'toolUse' }),
        fauxAssistantMessage('Shopping is your next task.'),
      ]);
      const source = runtimeFixture.options.models;
      const models = createModels();
      models.setProvider(
        createCachedProvider({
          source,
          provider: runtimeFixture.provider.provider,
          cassetteManager: cassettes,
        }),
      );
      const runtime = await openDurableRuntime({ ...runtimeFixture.options, models });
      try {
        expect(await runtime.execute(createTestInput())).toBe('Shopping is your next task.');
        expect(runtimeFixture.options.client.invoke).toHaveBeenCalledOnce();
        expect(runtimeFixture.provider.state.callCount).toBe(mode === 'record' ? 2 : 0);
        cassettes.assertConsumed();
      } finally {
        await runtime.close();
        cassettes.ejectCassette();
      }
    };
    await run('record');
    await run('playback');
  });
});
