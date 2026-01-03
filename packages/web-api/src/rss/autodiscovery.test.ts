import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAutodiscovery, discoverFeeds } from './autodiscovery.js';

describe('autodiscovery', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('discoverFeeds', () => {
    it('returns error for invalid URL protocol', async () => {
      const result = await discoverFeeds('ftp://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL protocol');
    });

    it('returns error for malformed URL', async () => {
      const result = await discoverFeeds('not-a-url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('returns error when fetch fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await discoverFeeds('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('detects RSS feed directly', async () => {
      const rssContent = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Test Feed</title>
          </channel>
        </rss>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssContent),
        headers: new Headers({ 'content-type': 'application/rss+xml' }),
      } as Response);

      const result = await discoverFeeds('https://example.com/feed.xml');

      expect(result.success).toBe(true);
      expect(result.isDirectFeed).toBe(true);
      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0].type).toBe('rss');
    });

    it('detects Atom feed directly', async () => {
      const atomContent = `<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Test Feed</title>
        </feed>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(atomContent),
        headers: new Headers({ 'content-type': 'application/atom+xml' }),
      } as Response);

      const result = await discoverFeeds('https://example.com/atom.xml');

      expect(result.success).toBe(true);
      expect(result.isDirectFeed).toBe(true);
      expect(result.feeds[0].type).toBe('atom');
    });

    it('discovers feeds from HTML page', async () => {
      const htmlContent = `<!DOCTYPE html>
        <html>
        <head>
          <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
          <link rel="alternate" type="application/atom+xml" href="/atom.xml" title="Atom Feed">
        </head>
        <body></body>
        </html>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlContent),
        headers: new Headers({ 'content-type': 'text/html' }),
      } as Response);

      const result = await discoverFeeds('https://example.com');

      expect(result.success).toBe(true);
      expect(result.isDirectFeed).toBe(false);
      expect(result.feeds).toHaveLength(2);
      expect(result.feeds[0].url).toBe('https://example.com/feed.xml');
      expect(result.feeds[0].title).toBe('RSS Feed');
      expect(result.feeds[0].type).toBe('rss');
      expect(result.feeds[1].url).toBe('https://example.com/atom.xml');
      expect(result.feeds[1].type).toBe('atom');
    });

    it('resolves relative URLs correctly', async () => {
      const htmlContent = `<!DOCTYPE html>
        <html>
        <head>
          <link rel="alternate" type="application/rss+xml" href="blog/feed.xml">
        </head>
        </html>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlContent),
        headers: new Headers({ 'content-type': 'text/html' }),
      } as Response);

      const result = await discoverFeeds('https://example.com/path/');

      expect(result.success).toBe(true);
      expect(result.feeds[0].url).toBe('https://example.com/path/blog/feed.xml');
    });

    it('returns error when no feeds found in HTML', async () => {
      const htmlContent = `<!DOCTYPE html>
        <html>
        <head><title>No feeds</title></head>
        <body></body>
        </html>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlContent),
        headers: new Headers({ 'content-type': 'text/html' }),
      } as Response);

      const result = await discoverFeeds('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No RSS/Atom feeds found');
    });

    it('handles timeout error', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      vi.mocked(fetch).mockRejectedValueOnce(abortError);

      const result = await discoverFeeds('https://example.com', { timeoutMs: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('handles network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await discoverFeeds('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('createAutodiscovery', () => {
    it('creates autodiscovery client with config', async () => {
      const rssContent = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssContent),
        headers: new Headers({ 'content-type': 'application/rss+xml' }),
      } as Response);

      const client = createAutodiscovery({ timeoutMs: 5000 });
      const result = await client.discoverFeeds('https://example.com/feed.xml');

      expect(result.success).toBe(true);
    });
  });
});
