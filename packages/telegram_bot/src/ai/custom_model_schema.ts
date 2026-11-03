import { z } from 'zod';

const compat = z.strictObject({
  supportsStore: z.boolean().optional(),
  supportsDeveloperRole: z.boolean().optional(),
  supportsReasoningEffort: z.boolean().optional(),
  supportsUsageInStreaming: z.boolean().optional(),
  supportsStrictMode: z.boolean().optional(),
  requiresReasoningContentOnAssistantMessages: z.boolean().optional(),
  maxTokensField: z.enum(['max_tokens', 'max_completion_tokens']).optional(),
  thinkingFormat: z
    .enum(['openai', 'qwen', 'qwen-chat-template', 'chat-template', 'deepseek'])
    .optional(),
});
const thinkingLevels = z.enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const cost = z
  .object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
    cacheRead: z.number().nonnegative(),
    cacheWrite: z.number().nonnegative(),
  })
  .default({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

export const customModelSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().optional(),
  reasoning: z.boolean().default(false),
  input: z.array(z.enum(['text', 'image'])).default(['text']),
  contextWindow: z.number().int().positive().default(32768),
  maxTokens: z.number().int().positive().default(4096),
  cost,
  compat: compat.optional(),
  thinkingLevelMap: z.partialRecord(thinkingLevels, z.string().nullable()).optional(),
});

export const customProviderSchema = z.strictObject({
  name: z.string().optional(),
  api: z.literal('openai-completions'),
  baseUrl: z.url().refine((value) => {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  }, 'Use a credential-free HTTP(S) endpoint without query parameters'),
  apiKey: z.string().optional(),
  compat: compat.optional(),
  models: z.array(customModelSchema).min(1),
});

export type CustomProviderConfig = z.infer<typeof customProviderSchema>;
