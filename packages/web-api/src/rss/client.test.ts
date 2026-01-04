import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRssClient, generateExternalId, mapItemToTodo } from './client.js';
import type { RssItem } from './types.js';

describe('client', () => {
  describe('generateExternalId', () => {
    it('generates consistent external ID from feed URL and guid', () => {
      const item: RssItem = {
        title: 'Test',
        description: 'Test description',
        link: 'https://example.com/post/1',
        guid: 'unique-guid-123',
        feedUrl: 'https://example.com/feed.xml',
      };

      const externalId = generateExternalId(item);

      expect(externalId).toMatch(/^rss:[a-f0-9]{8}\/[a-f0-9]{8}$/);
    });

    it('uses link as guid fallback', () => {
      const item: RssItem = {
        title: 'Test',
        description: '',
        link: 'https://example.com/post/1',
        guid: '',
        feedUrl: 'https://example.com/feed.xml',
      };

      const externalId = generateExternalId(item);

      expect(externalId).toMatch(/^rss:[a-f0-9]{8}\/[a-f0-9]{8}$/);
    });

    it('generates different IDs for different items', () => {
      const item1: RssItem = {
        title: 'Test 1',
        description: '',
        link: 'https://example.com/post/1',
        guid: 'guid-1',
        feedUrl: 'https://example.com/feed.xml',
      };

      const item2: RssItem = {
        title: 'Test 2',
        description: '',
        link: 'https://example.com/post/2',
        guid: 'guid-2',
        feedUrl: 'https://example.com/feed.xml',
      };

      expect(generateExternalId(item1)).not.toBe(generateExternalId(item2));
    });

    it('generates different IDs for same item from different feeds', () => {
      const item1: RssItem = {
        title: 'Test',
        description: '',
        link: 'https://example.com/post/1',
        guid: 'guid-1',
        feedUrl: 'https://example.com/feed1.xml',
      };

      const item2: RssItem = {
        title: 'Test',
        description: '',
        link: 'https://example.com/post/1',
        guid: 'guid-1',
        feedUrl: 'https://example.com/feed2.xml',
      };

      expect(generateExternalId(item1)).not.toBe(generateExternalId(item2));
    });
  });

  describe('mapItemToTodo', () => {
    it('maps RSS item to TodoAlpha3 structure', () => {
      const item: RssItem = {
        title: 'Test Article',
        description: '<p>This is a test description</p>',
        link: 'https://example.com/article',
        guid: 'article-123',
        pubDate: '2024-01-01T00:00:00Z',
        feedUrl: 'https://example.com/feed.xml',
        feedTitle: 'Example Feed',
      };

      const todo = mapItemToTodo(item, ['gtd:someday', 'source:rss']);

      expect(todo.title).toBe('Test Article');
      expect(todo.description).toBe('This is a test description');
      expect(todo.link).toBe('https://example.com/article');
      expect(todo.context).toBe('read-later');
      expect(todo.tags).toEqual(['gtd:someday', 'source:rss']);
      expect(todo.completed).toBeNull();
      expect(todo.version).toBe('alpha3');
      expect(todo.externalId).toMatch(/^rss:/);
    });

    it('strips HTML from description', () => {
      const item: RssItem = {
        title: 'Test',
        description: '<p>Hello <strong>world</strong></p>',
        link: 'https://example.com',
        guid: 'test',
        feedUrl: 'https://example.com/feed.xml',
      };

      const todo = mapItemToTodo(item, []);

      expect(todo.description).toBe('Hello world');
    });

    it('decodes HTML entities', () => {
      const item: RssItem = {
        title: 'Test',
        description: 'Tom &amp; Jerry &lt;3',
        link: 'https://example.com',
        guid: 'test',
        feedUrl: 'https://example.com/feed.xml',
      };

      const todo = mapItemToTodo(item, []);

      expect(todo.description).toBe('Tom & Jerry <3');
    });

    it('truncates long descriptions', () => {
      const item: RssItem = {
        title: 'Test',
        description: 'A'.repeat(3000),
        link: 'https://example.com',
        guid: 'test',
        feedUrl: 'https://example.com/feed.xml',
      };

      const todo = mapItemToTodo(item, []);

      expect(todo.description.length).toBeLessThanOrEqual(2000);
      expect(todo.description).toContain('...');
    });

    it('handles empty description', () => {
      const item: RssItem = {
        title: 'Test',
        description: '',
        link: 'https://example.com',
        guid: 'test',
        feedUrl: 'https://example.com/feed.xml',
      };

      const todo = mapItemToTodo(item, []);

      expect(todo.description).toBe('');
    });

    it('uses Untitled for missing title', () => {
      const item: RssItem = {
        title: '',
        description: 'Description',
        link: 'https://example.com',
        guid: 'test',
        feedUrl: 'https://example.com/feed.xml',
      };

      const todo = mapItemToTodo(item, []);

      expect(todo.title).toBe('Untitled');
    });
  });

  describe('createRssClient', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('fetches and parses RSS feed', async () => {
      const rssContent = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Test Feed</title>
            <item>
              <title>Article 1</title>
              <link>https://example.com/1</link>
              <description>Description 1</description>
              <guid>guid-1</guid>
            </item>
            <item>
              <title>Article 2</title>
              <link>https://example.com/2</link>
              <description>Description 2</description>
              <guid>guid-2</guid>
            </item>
          </channel>
        </rss>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssContent),
      } as Response);

      const client = createRssClient();
      const items = await client.fetchFeed({
        url: 'https://example.com',
        feedUrl: 'https://example.com/feed.xml',
        enabled: true,
        addedAt: new Date().toISOString(),
      });

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Article 1');
      expect(items[0].link).toBe('https://example.com/1');
      expect(items[1].title).toBe('Article 2');
    });

    it('fetches and parses Atom feed', async () => {
      const atomContent = `<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Test Feed</title>
          <entry>
            <title>Entry 1</title>
            <link href="https://example.com/1"/>
            <id>entry-1</id>
            <summary>Summary 1</summary>
          </entry>
        </feed>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(atomContent),
      } as Response);

      const client = createRssClient();
      const items = await client.fetchFeed({
        url: 'https://example.com',
        feedUrl: 'https://example.com/atom.xml',
        enabled: true,
        addedAt: new Date().toISOString(),
      });

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Entry 1');
      expect(items[0].link).toBe('https://example.com/1');
    });

    it('throws on fetch error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const client = createRssClient();

      await expect(
        client.fetchFeed({
          url: 'https://example.com',
          feedUrl: 'https://example.com/feed.xml',
          enabled: true,
          addedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow('500');
    });

    it('throws on timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      vi.mocked(fetch).mockRejectedValueOnce(abortError);

      const client = createRssClient({ timeoutMs: 100 });

      await expect(
        client.fetchFeed({
          url: 'https://example.com',
          feedUrl: 'https://example.com/feed.xml',
          enabled: true,
          addedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow('timed out');
    });

    it('skips items without link', async () => {
      const rssContent = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Test Feed</title>
            <item>
              <title>No Link</title>
              <description>This item has no link</description>
            </item>
            <item>
              <title>Has Link</title>
              <link>https://example.com/1</link>
            </item>
          </channel>
        </rss>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssContent),
      } as Response);

      const client = createRssClient();
      const items = await client.fetchFeed({
        url: 'https://example.com',
        feedUrl: 'https://example.com/feed.xml',
        enabled: true,
        addedAt: new Date().toISOString(),
      });

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Has Link');
    });
  });
});
