import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock environment variables
const mockEnv = {
  TELEGRAM_BOT_TOKEN: 'mock-token',
  ANTHROPIC_API_KEY: 'mock-key',
};

// Mock the shared environment validation
vi.mock('@eddo/core-server', () => ({
  validateEnv: vi.fn(() => ({})),
}));

// Mock dotenv
vi.mock('dotenv-mono', () => ({
  dotenvLoad: vi.fn(),
}));

vi.mock('@earendil-works/pi-ai', () => ({
  getEnvApiKey: vi.fn(() => 'mock-key'),
  getProviders: vi.fn(() => ['anthropic']),
  getModels: vi.fn(() => [
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
  ]),
}));

describe('Config Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.env to clean state
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('TELEGRAM_')) {
        delete process.env[key];
      }
    });
    // Set required env vars
    Object.assign(process.env, mockEnv);
  });

  describe('Configuration Loading', () => {
    it('should load config successfully with required environment variables', async () => {
      vi.resetModules();
      const { appConfig } = await import('./config');

      expect(appConfig.TELEGRAM_BOT_TOKEN).toBe('mock-token');
    });

    it('should set default values for optional environment variables', async () => {
      vi.resetModules();
      const { appConfig } = await import('./config');

      expect(appConfig.WEB_API_BASE_URL).toBe('http://localhost:3000');
      expect(appConfig.TELEGRAM_LOG_USER_DETAILS).toBe(false);
    });

    it('should parse TELEGRAM_LOG_USER_DETAILS as boolean', async () => {
      process.env.TELEGRAM_LOG_USER_DETAILS = 'true';
      vi.resetModules();
      const { appConfig } = await import('./config');

      expect(appConfig.TELEGRAM_LOG_USER_DETAILS).toBe(true);
    });

    it('should parse WEB_API_BASE_URL from environment', async () => {
      process.env.WEB_API_BASE_URL = 'https://api.example.com';
      vi.resetModules();
      const { appConfig } = await import('./config');

      expect(appConfig.WEB_API_BASE_URL).toBe('https://api.example.com');
    });
  });
});
