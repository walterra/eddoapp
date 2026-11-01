// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeFetchUrl } from './fetch_url.js';
import { readUrl } from './jina_reader.js';
import type { ToolContext } from './types.js';
import { resolveCapture } from './url_capture_store.js';

vi.mock('./jina_reader.js', () => ({ readUrl: vi.fn() }));

const context: ToolContext = {
  session: {
    userId: 'fetch-user',
    dbName: 'fetch-user',
    attachmentsDbName: 'attachments',
    username: 'fetch-user',
  },
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
};

afterEach(() => vi.clearAllMocks());

describe('fetchUrl tool', () => {
  it('returns a bounded preview and an account-scoped reference, reusing cached captures', async () => {
    const markdown = '# Page\n' + 'x'.repeat(5000);
    vi.mocked(readUrl).mockResolvedValue({
      title: 'Page',
      sourceUrl: 'https://example.com/cache',
      markdown,
      metadata: { 'web:provider': 'jina-reader' },
    });
    const first = JSON.parse(await executeFetchUrl({ url: 'https://example.com/cache' }, context));
    expect(first.data.preview).toHaveLength(2000);
    expect(resolveCapture('fetch-user', first.data.urlCaptureRef).markdown).toBe(markdown);
    const second = JSON.parse(await executeFetchUrl({ url: 'https://example.com/cache' }, context));
    expect(second.data.urlCaptureRef).toBe(first.data.urlCaptureRef);
    expect(readUrl).toHaveBeenCalledOnce();
  });

  it('returns a safe fallback error without leaking provider details', async () => {
    vi.mocked(readUrl).mockRejectedValue(new Error('secret upstream credentials'));
    const result = await executeFetchUrl({ url: 'https://example.com/failure' }, context);
    expect(JSON.parse(result)).toMatchObject({
      summary: expect.stringContaining('save the original URL'),
      error: expect.any(String),
    });
    expect(result).not.toContain('secret upstream');
  });

  it('requires an authenticated account', async () => {
    await expect(
      executeFetchUrl({ url: 'https://example.com' }, { log: context.log }),
    ).rejects.toThrow('Authenticated');
    expect(readUrl).not.toHaveBeenCalled();
  });
});
