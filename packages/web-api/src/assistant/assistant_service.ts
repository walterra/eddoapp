import { createUserRegistry, type Env } from '@eddo/core-server';
import { z } from 'zod';
import { AssistantApiError } from './assistant_errors';
import { createAssistantHostClient } from './assistant_host_client';
import { createAssistantProjectionStore } from './assistant_projection_store';
import type { AssistantService } from './assistant_types';

const hostConfiguration = z.object({
  ASSISTANT_INTERNAL_TOKEN: z.string().min(32).optional(),
  ASSISTANT_INTERNAL_PORT: z.coerce.number().int().min(1).max(65535).default(3003),
});

/** Composes projection reads and loopback transport; web-api never provisions or opens execution journals. */
export function createAssistantService(
  env: Env,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AssistantService {
  const settings = hostConfiguration.parse(environment);
  const registry = createUserRegistry(env.COUCHDB_URL, env);
  return {
    store: createAssistantProjectionStore({ env }),
    host: createAssistantHostClient({
      port: settings.ASSISTANT_INTERNAL_PORT,
      token: settings.ASSISTANT_INTERNAL_TOKEN,
    }),
    authorize: async (username) => {
      const user = await registry.findByUsername(username);
      if (user?.username !== username || user.status !== 'active' || !user.preferences?.mcpApiKey)
        throw new AssistantApiError(403, 'forbidden');
    },
  };
}
