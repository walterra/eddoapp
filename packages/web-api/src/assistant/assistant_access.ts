import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { AssistantApiError } from './assistant_errors';
import type { AssistantLimits } from './assistant_limits';
import type { AssistantIdentity, AssistantService } from './assistant_types';

interface AssistantRouteVariables {
  jwtPayload: unknown;
  assistantIdentity: AssistantIdentity;
}
export interface AssistantRouteEnv {
  Variables: AssistantRouteVariables;
}
const claimsSchema = z.object({ username: z.string().min(1).max(128), exp: z.number().positive() });

/** Applies assistant response policy before the application's shared JWT middleware. */
export function assistantHttpBoundary(): MiddlewareHandler {
  return async (context, next) => {
    context.header('Cache-Control', 'no-store');
    if (
      context.req.query('token') !== undefined ||
      !context.req.header('Authorization')?.startsWith('Bearer ')
    )
      return context.json({ error: 'unauthorized' }, 401);
    await next();
    if (context.res.status === 401) context.res = context.json({ error: 'unauthorized' }, 401);
    context.res.headers.set('Cache-Control', 'no-store');
  };
}

/** Requires upstream JWT verification, an expiring header token, and current registry authorization. */
export function assistantAccess(
  service: AssistantService,
  limits: AssistantLimits,
): MiddlewareHandler<AssistantRouteEnv> {
  return async (context, next) => {
    context.header('Cache-Control', 'no-store');
    if (
      context.req.query('token') !== undefined ||
      !context.req.header('Authorization')?.startsWith('Bearer ')
    )
      throw new AssistantApiError(401, 'unauthorized');
    const claims = claimsSchema.safeParse(context.get('jwtPayload'));
    if (!claims.success || claims.data.exp * 1000 <= Date.now())
      throw new AssistantApiError(401, 'unauthorized');
    await service.authorize(claims.data.username);
    context.set('assistantIdentity', {
      username: claims.data.username,
      expiresAt: claims.data.exp * 1000,
    });
    limits.consume(claims.data.username, context.req.method === 'POST');
    await next();
  };
}
