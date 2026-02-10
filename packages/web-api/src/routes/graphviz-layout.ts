/**
 * Graphviz layout API route.
 * Renders DOT server-side and returns node positions for client-side React Flow rendering.
 */
import type { Viz } from '@viz-js/viz';
import { Hono } from 'hono';
import { z } from 'zod';

import { logger, withSpan } from '../utils/logger';
import { extractUserFromToken } from './users-helpers';

const graphvizLayoutApp = new Hono();
const DOT_MAX_LENGTH = 200_000;
const LAYOUT_TIMEOUT_MS = 5_000;

const requestSchema = z.object({
  dot: z.string().min(1).max(DOT_MAX_LENGTH),
});

let vizInstancePromise: Promise<Viz> | null = null;

/** Load and cache Graphviz WASM instance. */
const getVizInstance = async (): Promise<Viz> => {
  if (!vizInstancePromise) {
    vizInstancePromise = import('@viz-js/viz').then((module) => module.instance());
  }

  return vizInstancePromise;
};

/** Build timeout promise for layout execution guard. */
const createTimeoutPromise = (timeoutMs: number): Promise<never> =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Layout timed out after ${timeoutMs}ms`)), timeoutMs);
  });

/** Execute Graphviz DOT layout and return JSON output. */
const renderDotLayout = async (dot: string): Promise<unknown> => {
  const viz = await getVizInstance();
  return viz.renderJSON(dot, {
    engine: 'dot',
    yInvert: true,
  });
};

/**
 * POST /api/graphviz/layout
 * Body: { dot: string }
 * Returns: { layout: GraphvizJSON }
 */
graphvizLayoutApp.post('/layout', async (c) => {
  return withSpan('graphviz_layout', { 'layout.engine': 'graphviz-dot' }, async (span) => {
    const userToken = await extractUserFromToken(c.req.header('Authorization'));
    if (userToken) {
      span.setAttribute('user.name', userToken.username);
    }

    const rawBody = await c.req.json().catch(() => null);
    const parsed = requestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid request body',
          details: parsed.error.issues.map((issue) => issue.message),
        },
        400,
      );
    }

    try {
      const layout = await Promise.race([
        renderDotLayout(parsed.data.dot),
        createTimeoutPromise(LAYOUT_TIMEOUT_MS),
      ]);

      return c.json({ layout });
    } catch (error) {
      logger.error(
        {
          error,
          dotLength: parsed.data.dot.length,
        },
        'Graphviz layout rendering failed',
      );

      return c.json({ error: 'Graphviz layout failed' }, 500);
    }
  });
});

export const graphvizLayoutRoutes = graphvizLayoutApp;
