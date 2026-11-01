// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readUrl } from './jina_reader.js';

vi.mock('node:dns/promises', () => ({
  resolve4: vi.fn(async () => ['8.8.8.8']),
  resolve6: vi.fn(async () => []),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function response(
  content = '# Article\n\nOriginal **Markdown** [link](https://example.com)',
): Response {
  return Response.json({
    data: {
      title: 'Article',
      url: 'https://example.com/final',
      content,
      publishedTime: '2026-10-01',
      author: ['Alice', 'Bob'],
      description: 'Page description',
      arbitrary: 'discard this',
    },
  });
}

describe('Jina Reader extraction', () => {
  it('requests JSON, retains Markdown and allowlisted metadata', async () => {
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetch);
    vi.stubEnv('JINA_API_KEY', 'reader-secret');
    const capture = await readUrl('https://example.com/article#section');
    expect(fetch).toHaveBeenCalledWith(
      'https://r.jina.ai/https://example.com/article',
      expect.objectContaining({
        redirect: 'error',
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer reader-secret',
        }),
      }),
    );
    expect(capture.markdown).toContain('Original **Markdown**');
    expect(capture.sourceUrl).toBe('https://example.com/article#section');
    expect(capture.metadata).toMatchObject({
      'web:title': 'Article',
      'web:resolvedUrl': 'https://example.com/final',
      'web:author': 'Alice, Bob',
      'web:publishedAt': '2026-10-01',
      'web:description': 'Page description',
      'web:truncated': 'false',
    });
    expect(capture.metadata).not.toHaveProperty('web:arbitrary');
  });

  it('marks truncated Unicode content without broken characters', async () => {
    vi.stubEnv('JINA_MAX_CONTENT_BYTES', '1024');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('€'.repeat(1000))));
    const capture = await readUrl('https://example.com');
    expect(capture.markdown).toContain('[Page content truncated by Eddo]');
    expect(capture.markdown).not.toContain('\uFFFD');
    expect(capture.metadata['web:truncated']).toBe('true');
  });

  it('omits unavailable metadata and uses a hostname title fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: { content: 'Text' } })));
    const capture = await readUrl('https://example.com');
    expect(capture.title).toBe('example.com');
    expect(capture.metadata).not.toHaveProperty('web:author');
  });

  it.each([429, 500])('rejects HTTP %s without exposing upstream text', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private detail', { status })));
    await expect(readUrl('https://example.com')).rejects.toThrow('Reader request failed');
  });

  it('rejects invalid JSON payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: { content: '' } })));
    await expect(readUrl('https://example.com')).rejects.toThrow();
  });

  it('rejects oversized upstream bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('a'.repeat(4_000_001))));
    await expect(readUrl('https://example.com')).rejects.toThrow('transport limit');
  });

  it('rejects private resolved destinations reported by Reader', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: { content: 'Text', url: 'http://127.0.0.1' },
        }),
      ),
    );
    await expect(readUrl('https://example.com')).rejects.toThrow('Private');
  });

  it('propagates transport timeouts without retries', async () => {
    const fetch = vi.fn().mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    vi.stubGlobal('fetch', fetch);
    await expect(readUrl('https://example.com')).rejects.toThrow('Timeout');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
