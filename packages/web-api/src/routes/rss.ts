/**
 * RSS API routes
 */
import { Hono } from 'hono';

import { discoverFeeds } from '../rss/autodiscovery.js';

export const rssRoutes = new Hono();

/**
 * POST /api/rss/discover
 * Discovers RSS/Atom feeds from a URL
 */
rssRoutes.post('/discover', async (c) => {
  try {
    const { url } = await c.req.json<{ url: string }>();

    if (!url) {
      return c.json({ success: false, error: 'URL is required' }, 400);
    }

    const result = await discoverFeeds(url);
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to discover feeds',
      },
      500,
    );
  }
});
