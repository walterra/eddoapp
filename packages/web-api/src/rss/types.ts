/**
 * RSS sync types
 */

export interface RssFeedConfig {
  /** Original URL provided by user */
  url: string;
  /** Discovered/resolved feed URL */
  feedUrl: string;
  /** Feed title (from autodiscovery or feed itself) */
  title?: string;
  /** Whether this feed is enabled for sync */
  enabled: boolean;
  /** ISO timestamp when feed was added */
  addedAt: string;
}

export interface RssItem {
  /** Item title */
  title: string;
  /** Item description/content */
  description: string;
  /** Item link/URL */
  link: string;
  /** Unique identifier (guid or link) */
  guid: string;
  /** Publication date as ISO string */
  pubDate?: string;
  /** Feed URL this item came from */
  feedUrl: string;
  /** Feed title */
  feedTitle?: string;
}

export interface DiscoveredFeed {
  /** Feed URL */
  url: string;
  /** Feed title from link tag */
  title?: string;
  /** Feed type (rss, atom, etc.) */
  type: 'rss' | 'atom' | 'rdf' | 'json' | 'unknown';
}

export interface AutodiscoveryResult {
  /** Whether autodiscovery was successful */
  success: boolean;
  /** Discovered feeds */
  feeds: DiscoveredFeed[];
  /** Error message if failed */
  error?: string;
  /** Whether the original URL was already a feed */
  isDirectFeed?: boolean;
}
