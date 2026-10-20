import { z } from 'zod';

const durableConfigSchema = z.object({
  TELEGRAM_DURABLE_USERS: z.string().default(''),
  TELEGRAM_DURABLE_MODEL: z
    .string()
    .regex(/^[^/]+\/.+$/)
    .default('anthropic/claude-sonnet-4-5'),
});

export interface DurableConfig {
  users: readonly string[];
  model: { provider: string; modelId: string };
}

/** Parses the opt-in pilot configuration without changing the legacy model. */
export function parseDurableConfig(environment: Record<string, string | undefined>): DurableConfig {
  const config = durableConfigSchema.parse(environment);
  const separator = config.TELEGRAM_DURABLE_MODEL.indexOf('/');
  return {
    users: [
      ...new Set(
        config.TELEGRAM_DURABLE_USERS.split(',')
          .map((user) => user.trim())
          .filter(Boolean),
      ),
    ],
    model: {
      provider: config.TELEGRAM_DURABLE_MODEL.slice(0, separator),
      modelId: config.TELEGRAM_DURABLE_MODEL.slice(separator + 1),
    },
  };
}
