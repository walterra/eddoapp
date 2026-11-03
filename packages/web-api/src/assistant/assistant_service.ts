import { createUserRegistry, type Env } from '@eddo/core-server';
import { validateMinimumTextLength } from '@eddo/core-shared/validation/compatibility';
import {
  coerceNumber,
  createFieldNormalizer,
} from '@eddo/core-shared/validation/field_normalization';
import { createSchemaParser, int, obj, opt, str } from '@eddo/core-shared/validation/schema_parser';
import { AssistantApiError } from './assistant_errors';
import { createAssistantHostClient } from './assistant_host_client';
import { createAssistantProjectionStore } from './assistant_projection_store';
import type { AssistantService } from './assistant_types';

const hostConfiguration = createSchemaParser(
  obj({
    ASSISTANT_INTERNAL_TOKEN: opt(str()),
    ASSISTANT_INTERNAL_PORT: int({ minimum: 1, maximum: 65535 }),
  }),
  {
    normalize: createFieldNormalizer({
      fields: ['ASSISTANT_INTERNAL_TOKEN', 'ASSISTANT_INTERNAL_PORT'],
      defaults: { ASSISTANT_INTERNAL_PORT: 3003 },
      conversions: { ASSISTANT_INTERNAL_PORT: coerceNumber },
    }),
    validate: (value) =>
      value.ASSISTANT_INTERNAL_TOKEN === undefined
        ? []
        : validateMinimumTextLength(
            value.ASSISTANT_INTERNAL_TOKEN,
            32,
            '/ASSISTANT_INTERNAL_TOKEN',
          ),
  },
);

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
