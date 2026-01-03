/**
 * RSS Sync Module
 * Provides RSS/Atom feed synchronization with autodiscovery support
 */

export { createAutodiscovery, discoverFeeds } from './autodiscovery.js';
export type { AutodiscoveryConfig } from './autodiscovery.js';

export { createRssClient, generateExternalId, mapItemToTodo } from './client.js';
export type { RssClient, RssClientConfig, SyncLogger } from './client.js';

export { RssSyncScheduler, createRssSyncScheduler, shouldSyncUser } from './sync-scheduler.js';

export type { AutodiscoveryResult, DiscoveredFeed, RssFeedConfig, RssItem } from './types.js';
