/**
 * RSS Client for fetching and parsing feeds
 */
import type { TodoAlpha3 } from '@eddo/core-shared';
import { createHash } from 'crypto';
import { parseFeed } from 'feedsmith';

import type { RssFeedConfig, RssItem } from './types.js';

export interface RssClientConfig {
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** User agent for requests */
  userAgent?: string;
}

export interface SyncLogger {
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
  debug: (msg: string, meta?: unknown) => void;
}

export interface RssClient {
  fetchFeed(feedConfig: RssFeedConfig): Promise<RssItem[]>;
  mapItemToTodo(item: RssItem, tags: string[]): Omit<TodoAlpha3, '_rev'>;
  generateExternalId(item: RssItem): string;
}

const DEFAULT_CONFIG: Required<RssClientConfig> = {
  timeoutMs: 30000,
  userAgent: 'Eddo RSS Sync/1.0',
};

/**
 * Generates a short hash from a string (first 8 chars of SHA256)
 */
function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').substring(0, 8);
}

/**
 * Generates external ID for RSS item
 * Format: rss:<feed-url-hash>/<item-guid-or-link-hash>
 */
export function generateExternalId(item: RssItem): string {
  const feedHash = shortHash(item.feedUrl);
  const itemHash = shortHash(item.guid || item.link);
  return `rss:${feedHash}/${itemHash}`;
}

/**
 * Strips HTML tags and decodes entities from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncates text to a maximum length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Parses publication date from RSS item, returns ISO string or current time as fallback
 */
function parsePubDate(pubDate: string | undefined): string {
  if (!pubDate) return new Date().toISOString();

  try {
    const parsed = new Date(pubDate);
    if (isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Maps RSS item to TodoAlpha3 structure
 */
export function mapItemToTodo(item: RssItem, tags: string[]): Omit<TodoAlpha3, '_rev'> {
  const now = new Date().toISOString();
  const cleanDescription = item.description ? truncate(stripHtml(item.description), 2000) : '';
  const dueDate = parsePubDate(item.pubDate);

  return {
    _id: now,
    active: {},
    completed: null,
    context: 'read-later',
    description: cleanDescription,
    due: dueDate,
    externalId: generateExternalId(item),
    link: item.link,
    repeat: null,
    tags,
    title: item.title || 'Untitled',
    version: 'alpha3',
  };
}

type FeedItem = Record<string, unknown>;

/**
 * Extracts string value from various field formats
 */
function extractStringField(item: FeedItem, ...fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    const value = item[fieldName];
    if (typeof value === 'string') return value;
    if (value && typeof (value as Record<string, unknown>).value === 'string') {
      return (value as Record<string, unknown>).value as string;
    }
    if (value && typeof (value as Record<string, unknown>).href === 'string') {
      return (value as Record<string, unknown>).href as string;
    }
  }
  return '';
}

/**
 * Extracts link from feed item
 */
function extractLink(item: FeedItem): string {
  const directLink = extractStringField(item, 'link', 'url');
  if (directLink) return directLink;

  if (Array.isArray(item.links) && item.links.length > 0) {
    const firstLink = item.links[0] as Record<string, unknown>;
    return (firstLink.href as string) || '';
  }
  return '';
}

/**
 * Extracts description/content from feed item
 */
function extractDescription(item: FeedItem): string {
  return extractStringField(
    item,
    'description',
    'summary',
    'content',
    'content_html',
    'content_text',
  );
}

/**
 * Extracts guid from feed item
 */
function extractGuid(item: FeedItem, link: string): string {
  const guid = extractStringField(item, 'guid', 'id');
  return guid || link;
}

/**
 * Extracts publication date from feed item
 */
function extractPubDate(item: FeedItem): string | undefined {
  const date = extractStringField(item, 'pubDate', 'published', 'updated', 'date_published');
  return date || undefined;
}

/**
 * Converts a raw feed item to RssItem
 */
function convertToRssItem(rawItem: unknown, feedUrl: string, feedTitle?: string): RssItem | null {
  const item = rawItem as FeedItem;

  const title = extractStringField(item, 'title') || 'Untitled';
  const link = extractLink(item);
  if (!link) return null;

  return {
    title,
    description: extractDescription(item),
    link,
    guid: extractGuid(item, link),
    pubDate: extractPubDate(item),
    feedUrl,
    feedTitle,
  };
}

/**
 * Gets items array from parsed feed based on format
 */
function getRawItems(
  feed: ReturnType<typeof parseFeed>['feed'],
  format: ReturnType<typeof parseFeed>['format'],
): unknown[] {
  if ((format === 'rss' || format === 'rdf' || format === 'json') && 'items' in feed) {
    return (feed.items as unknown[]) || [];
  }
  if (format === 'atom' && 'entries' in feed) {
    return (feed.entries as unknown[]) || [];
  }
  return [];
}

/**
 * Extracts items from parsed feed
 */
function extractItems(
  feed: ReturnType<typeof parseFeed>['feed'],
  format: ReturnType<typeof parseFeed>['format'],
  feedUrl: string,
  feedTitle?: string,
): RssItem[] {
  const rawItems = getRawItems(feed, format);
  const items: RssItem[] = [];

  for (const rawItem of rawItems) {
    const item = convertToRssItem(rawItem, feedUrl, feedTitle);
    if (item) items.push(item);
  }

  return items;
}

/**
 * Extracts feed title from parsed feed
 */
function extractFeedTitle(feed: ReturnType<typeof parseFeed>['feed']): string | undefined {
  if ('title' in feed) {
    if (typeof feed.title === 'string') return feed.title;
    const titleObj = feed.title as Record<string, unknown> | undefined;
    if (titleObj && typeof titleObj.value === 'string') return titleObj.value;
  }
  return undefined;
}

/**
 * Fetches feed content with timeout
 */
async function fetchFeedContent(
  feedUrl: string,
  config: Required<RssClientConfig>,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': config.userAgent,
        Accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Creates RSS client for fetching and parsing feeds
 */
export function createRssClient(
  clientConfig: RssClientConfig = {},
  logger: SyncLogger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  },
): RssClient {
  const config = { ...DEFAULT_CONFIG, ...clientConfig };

  return {
    async fetchFeed(feedConfig: RssFeedConfig): Promise<RssItem[]> {
      const { feedUrl } = feedConfig;
      logger.debug('Fetching RSS feed', { feedUrl });

      try {
        const content = await fetchFeedContent(feedUrl, config);
        const { format, feed } = parseFeed(content);
        const feedTitle = feedConfig.title || extractFeedTitle(feed);
        const items = extractItems(feed, format, feedUrl, feedTitle);

        logger.info('Successfully fetched RSS feed', {
          feedUrl,
          feedTitle,
          format,
          itemCount: items.length,
        });

        return items;
      } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        const message = isTimeout
          ? `Feed fetch timed out after ${config.timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error);

        logger.error('Failed to fetch RSS feed', { feedUrl, error: message });
        throw new Error(message);
      }
    },

    mapItemToTodo,
    generateExternalId,
  };
}
