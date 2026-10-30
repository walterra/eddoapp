import type { AssistantRequest } from '@eddo/core-shared';
import { z } from 'zod';

const telegramMetadata = z.object({
  chatId: z.number().int().positive(),
  userId: z.number().int().positive(),
  messageId: z.number().int().nonnegative().optional(),
});
const assistantRequestSchema = z.object({
  account: z.object({ username: z.string().min(1) }),
  requestId: z.string().min(1),
  conversationId: z.string().min(1),
  text: z.string().min(1),
  source: z.discriminatedUnion('channel', [
    z.object({ channel: z.literal('web') }),
    z.object({ channel: z.literal('telegram'), telegram: telegramMetadata }),
  ]),
  createdAt: z.iso.datetime(),
  deadline: z.number().finite().positive(),
  report: z
    .object({ type: z.enum(['briefing', 'recap']), occurrence: z.string().min(1) })
    .optional(),
});

/** Validates channel-neutral requests before admission or resumed tool authorization. */
export function parseAssistantRequest(value: unknown): AssistantRequest {
  return assistantRequestSchema.parse(value);
}
