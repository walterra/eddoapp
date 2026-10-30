import { z } from 'zod';

export const receiptSchema = z.object({
  requestId: z.string().min(1).max(256),
  conversationId: z.string().min(1).max(256),
  status: z.enum([
    'queued',
    'working',
    'delivering',
    'projecting',
    'completed',
    'failed',
    'aborted',
  ]),
});
export const sharedRequestsSchema = z.object({
  requests: z.array(receiptSchema).max(100),
  hasMore: z.boolean(),
});
const conversation = z.object({
  _id: z.string(),
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
const message = z.object({
  _id: z.string(),
  _rev: z.string().optional(),
  version: z.literal('assistant_conversation_message_alpha1'),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  channel: z.enum(['web', 'telegram']),
  createdAt: z.string(),
  sequence: z.number(),
});
export const historySchema = z.object({
  conversation: conversation.nullable(),
  messages: z.array(message),
  nextCursor: z.string().nullable(),
  changeCursor: z.string(),
});
export const pendingSchema = z.object({
  username: z.string(),
  submissionId: z.uuid(),
  text: z.string().min(1).max(8000),
  createdAt: z.iso.datetime(),
  conversationId: z.string().nullable(),
  projectionIds: z.object({
    user: z.string().regex(/^assistant_message_durable_[a-f0-9]{64}_user$/),
    assistant: z.string().regex(/^assistant_message_durable_[a-f0-9]{64}_assistant$/),
  }),
  receipt: receiptSchema.optional(),
});
