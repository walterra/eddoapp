/**
 * RSS/Atom feed autodiscovery
 * Discovers feed URLs from HTML pages by parsing <link rel="alternate"> tags
 */
import { detectAtomFeed, detectJsonFeed, detectRdfFeed, detectRssFeed } from 'feedsmith';

import type { AutodiscoveryResult, DiscoveredFeed } from './types.js';

/** Supported feed MIME types */
const FEED_MIME_TYPES = [
  'application/rss+xml',
  'application/atom+xml',
  'application/rdf+xml',
  'application/feed+json',
  'application/json',
  'text/xml',
  'application/xml',
];

/**
 * Extracts feed type from MIME type
 */
function getFeedTypeFromMime(mimeType: string): DiscoveredFeed['type'] {
  if (mimeType.includes('rss')) return 'rss';
  if (mimeType.includes('atom')) return 'atom';
  if (mimeType.includes('rdf')) return 'rdf';
  if (mimeType.includes('json')) return 'json';
  return 'unknown';
}

/**
 * Detects feed type from content
 */
function detectFeedType(content: string): DiscoveredFeed['type'] | null {
  if (detectRssFeed(content)) return 'rss';
  if (detectAtomFeed(content)) return 'atom';
  if (detectRdfFeed(content)) return 'rdf';
  if (detectJsonFeed(content)) return 'json';
  return null;
}

/**
 * Resolves a potentially relative URL against a base URL
 */
function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/**
 * Checks if MIME type is a feed type
 */
function isFeedMimeType(mimeType: string): boolean {
  const lowerMime = mimeType.toLowerCase();
  return FEED_MIME_TYPES.some((t) => lowerMime.includes(t.split('/')[1]));
}

/**
 * Parses a single link tag and extracts feed info if valid
 */
function parseSingleLinkTag(attributes: string, baseUrl: string): DiscoveredFeed | null {
  // Check for rel="alternate"
  const relMatch = /rel\s*=\s*["']?alternate["']?/i.exec(attributes);
  if (!relMatch) return null;

  // Check for feed MIME type
  const typeMatch = /type\s*=\s*["']?([^"'\s>]+)["']?/i.exec(attributes);
  if (!typeMatch) return null;

  const mimeType = typeMatch[1].toLowerCase();
  if (!isFeedMimeType(mimeType)) return null;

  // Extract href
  const hrefMatch = /href\s*=\s*["']?([^"'\s>]+)["']?/i.exec(attributes);
  if (!hrefMatch) return null;

  const href = hrefMatch[1];
  const resolvedUrl = resolveUrl(href, baseUrl);

  // Extract optional title
  const titleMatch = /title\s*=\s*["']([^"']+)["']/i.exec(attributes);
  const title = titleMatch ? titleMatch[1] : undefined;

  return {
    url: resolvedUrl,
    title,
    type: getFeedTypeFromMime(mimeType),
  };
}

/**
 * Parses link tags from HTML to find feed URLs
 */
function parseFeedLinks(html: string, baseUrl: string): DiscoveredFeed[] {
  const feeds: DiscoveredFeed[] = [];
  const linkRegex = /<link\s+([^>]*?)>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const feed = parseSingleLinkTag(match[1], baseUrl);
    if (feed) feeds.push(feed);
  }

  return feeds;
}

export interface AutodiscoveryConfig {
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** User agent for requests */
  userAgent?: string;
}

const DEFAULT_CONFIG: Required<AutodiscoveryConfig> = {
  timeoutMs: 10000,
  userAgent: 'Eddo RSS Sync/1.0',
};

/**
 * Validates URL and returns error if invalid
 */
function validateUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return 'Invalid URL protocol. Only HTTP and HTTPS are supported.';
    }
    return null;
  } catch {
    return 'Invalid URL format.';
  }
}

/**
 * Fetches URL content with timeout
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  userAgent: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Accept:
          'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml,*/*',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Checks if content appears to be HTML
 */
function isHtmlContent(content: string, contentType: string): boolean {
  const trimmed = content.trim();
  return (
    contentType.includes('html') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')
  );
}

/**
 * Processes fetched content and returns autodiscovery result
 */
function processContent(url: string, content: string, contentType: string): AutodiscoveryResult {
  // Check if the URL is already a feed
  const feedType = detectFeedType(content);
  if (feedType) {
    return { success: true, feeds: [{ url, type: feedType }], isDirectFeed: true };
  }

  // If it's HTML, parse for feed links
  if (isHtmlContent(content, contentType)) {
    const feeds = parseFeedLinks(content, url);
    if (feeds.length === 0) {
      return { success: false, feeds: [], error: 'No RSS/Atom feeds found on this page.' };
    }
    return { success: true, feeds, isDirectFeed: false };
  }

  return {
    success: false,
    feeds: [],
    error: 'URL is neither a feed nor an HTML page with feed links.',
  };
}

/**
 * Handles errors during feed discovery
 */
function handleDiscoveryError(error: unknown, timeoutMs: number): AutodiscoveryResult {
  if (error instanceof Error && error.name === 'AbortError') {
    return { success: false, feeds: [], error: `Request timed out after ${timeoutMs}ms` };
  }
  const message = error instanceof Error ? error.message : 'Unknown error during feed discovery';
  return { success: false, feeds: [], error: message };
}

/**
 * Discovers RSS/Atom feeds from a URL
 */
export async function discoverFeeds(
  url: string,
  config: AutodiscoveryConfig = {},
): Promise<AutodiscoveryResult> {
  const { timeoutMs, userAgent } = { ...DEFAULT_CONFIG, ...config };

  const validationError = validateUrl(url);
  if (validationError) {
    return { success: false, feeds: [], error: validationError };
  }

  try {
    const response = await fetchWithTimeout(url, timeoutMs, userAgent);

    if (!response.ok) {
      return {
        success: false,
        feeds: [],
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
      };
    }

    const content = await response.text();
    const contentType = response.headers.get('content-type') || '';

    return processContent(url, content, contentType);
  } catch (error) {
    return handleDiscoveryError(error, timeoutMs);
  }
}

/**
 * Factory function for creating an autodiscovery client
 */
export function createAutodiscovery(config: AutodiscoveryConfig = {}) {
  return {
    discoverFeeds: (url: string) => discoverFeeds(url, config),
  };
}
