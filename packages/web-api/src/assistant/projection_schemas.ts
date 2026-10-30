import { z } from 'zod';

const id = z.string().min(1).max(256);
const telegram = z.object({
  chatId: z.number(),
  userId: z.number(),
  messageId: z.number().optional(),
});
export const conversationSchema = z.object({
  _id: id,
  _rev: z.string().optional(),
  version: z.literal('assistant_conversation_alpha1'),
  username: z.string(),
  active: z.boolean(),
  title: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stats: z.object({
    messageCount: z.number(),
    userMessageCount: z.number(),
    assistantMessageCount: z.number(),
  }),
});
export const messageSchema = z.object({
  _id: id,
  _rev: z.string().optional(),
  version: z.literal('assistant_conversation_message_alpha1'),
  conversationId: id,
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  channel: z.enum(['web', 'telegram']),
  channelMetadata: z.object({ telegram: telegram.optional() }).optional(),
  createdAt: z.string(),
  sequence: z.number().nonnegative(),
});
export const sequenceSchema = z
  .union([z.string().min(1).max(2048), z.number().nonnegative()])
  .transform(String);
export const changesSchema = z.object({
  last_seq: sequenceSchema,
  results: z.array(z.object({ id: z.string(), seq: sequenceSchema })).max(100),
});
