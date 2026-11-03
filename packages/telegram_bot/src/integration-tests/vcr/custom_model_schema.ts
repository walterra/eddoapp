import { z } from 'zod';
import { customProviderSchema } from '../../ai/custom_model_schema.js';

/** Stores only the selected model's public configuration, never authentication. */
export const portableModelSchema = z.object({
  version: z.literal(1),
  provider: z.string().min(1),
  config: customProviderSchema.omit({ apiKey: true }),
});

export type PortableModelConfig = z.infer<typeof portableModelSchema>;
