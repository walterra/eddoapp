import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockSpan {
  setAttribute: ReturnType<typeof vi.fn>;
}

interface MockStreamEvent {
  type: string;
}

interface MockAssistantMessage {
  content: Array<{ type: string; text?: string }>;
  usage: { input: number; output: number };
  stopReason: string;
  errorMessage?: string;
}

function createMockStream(events: MockStreamEvent[], result: MockAssistantMessage) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
    async result() {
      return result;
    },
  };
}

describe('llmService', () => {
  const mockSpan: MockSpan = {
    setAttribute: vi.fn(),
  };

  const mockWithSpan = vi.fn(
    async (
      _name: string,
      _attributes: Record<string, string | number>,
      callback: (span: MockSpan) => Promise<string>,
    ) => callback(mockSpan),
  );

  const mockStreamSimple = vi.fn();
  const mockGetEnvApiKey = vi.fn(() => 'test-key');
  const mockGetProviders = vi.fn(() => ['anthropic', 'openai']);
  const mockGetModels = vi.fn((provider: string) => {
    if (provider === 'anthropic') {
      return [
        {
          id: 'claude-haiku-4-5-20251001',
          name: 'Claude Haiku',
          api: 'anthropic-messages',
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          reasoning: true,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 200000,
          maxTokens: 1000,
        },
      ];
    }

    return [
      {
        id: 'gpt-4.1-mini',
        name: 'GPT 4.1 mini',
        api: 'openai-responses',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        reasoning: true,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 1000,
      },
    ];
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock('../utils/config.js', () => ({
      appConfig: {
        LLM_MODEL: 'claude-haiku-4-5-20251001',
      },
    }));

    vi.doMock('../utils/logger.js', () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      withSpan: mockWithSpan,
    }));

    vi.doMock('@earendil-works/pi-ai', () => ({
      getEnvApiKey: mockGetEnvApiKey,
      getModels: mockGetModels,
      getProviders: mockGetProviders,
      streamSimple: mockStreamSimple,
    }));
  });

  it('generates text response and records token attributes', async () => {
    mockStreamSimple.mockReturnValue(
      createMockStream([], {
        content: [{ type: 'text', text: 'Hello from pi-ai' }],
        usage: { input: 10, output: 20 },
        stopReason: 'stop',
      }),
    );

    const { llmService } = await import('./llm-service.js');

    const response = await llmService.generateResponse(
      [{ role: 'user', content: 'Hi', timestamp: Date.now() }],
      'You are helpful',
    );

    expect(response).toBe('Hello from pi-ai');
    expect(mockStreamSimple).toHaveBeenCalledTimes(1);
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.response_length', 16);
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.input_tokens', 10);
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.output_tokens', 20);
  });

  it('routes provider-prefixed custom ids to openai provider fallback', async () => {
    vi.doMock('../utils/config.js', () => ({
      appConfig: {
        LLM_MODEL: 'openai/gpt-4o-mini',
      },
    }));

    mockStreamSimple.mockReturnValue(
      createMockStream([], {
        content: [{ type: 'text', text: 'OpenAI response' }],
        usage: { input: 4, output: 6 },
        stopReason: 'stop',
      }),
    );

    const { llmService } = await import('./llm-service.js');

    await llmService.generateResponse(
      [{ role: 'user', content: 'Hi', timestamp: Date.now() }],
      'You are helpful',
    );

    expect(mockGetEnvApiKey).toHaveBeenCalledWith('openai');
    expect(mockStreamSimple).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'openai', id: 'gpt-4o-mini' }),
      expect.any(Object),
      expect.objectContaining({ apiKey: 'test-key' }),
    );
  });

  it('throws when stream result has error stop reason', async () => {
    mockStreamSimple.mockReturnValue(
      createMockStream([], {
        content: [],
        usage: { input: 1, output: 1 },
        stopReason: 'error',
        errorMessage: 'provider failure',
      }),
    );

    const { llmService } = await import('./llm-service.js');

    await expect(
      llmService.generateResponse(
        [{ role: 'user', content: 'Hi', timestamp: Date.now() }],
        'You are helpful',
      ),
    ).rejects.toThrow('LLM API error: provider failure');
  });
});
