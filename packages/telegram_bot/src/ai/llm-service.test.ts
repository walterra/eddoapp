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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock('../utils/config.js', () => ({
      appConfig: {
        ANTHROPIC_API_KEY: 'test-key',
        LLM_MODEL: 'claude-3-5-haiku-20241022',
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

    vi.doMock('@mariozechner/pi-ai', () => ({
      getModels: vi.fn(() => []),
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
