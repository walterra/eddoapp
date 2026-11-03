// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveCustomApiKey } from './custom_model_auth.js';

afterEach(() => vi.unstubAllEnvs());

describe('custom model credentials', () => {
  it('resolves environment interpolation and literals', async () => {
    vi.stubEnv('LOCAL_MODEL_KEY', 'test-key');
    expect(await resolveCustomApiKey('${LOCAL_MODEL_KEY}')).toBe('test-key');
    expect(await resolveCustomApiKey('$LOCAL_MODEL_KEY')).toBe('test-key');
    expect(await resolveCustomApiKey('literal-key')).toBe('literal-key');
  });

  it('supports explicitly trusted Pi credential commands', async () => {
    expect(await resolveCustomApiKey('!printf test-command-key')).toBe('test-command-key');
  });

  it('redacts failed command details', async () => {
    await expect(resolveCustomApiKey('!printf SECRET >&2; exit 1')).rejects.toThrow(
      'Custom provider credential command failed',
    );
  });

  it('rejects missing credentials', async () => {
    vi.stubEnv('MISSING_QWEN_KEY', '');
    await expect(resolveCustomApiKey(undefined)).rejects.toThrow('requires apiKey');
    await expect(resolveCustomApiKey('$MISSING_QWEN_KEY')).rejects.toThrow('environment variable');
    await expect(resolveCustomApiKey(' ')).rejects.toThrow('empty');
  });
});
