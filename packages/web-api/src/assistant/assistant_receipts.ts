import { z } from 'zod';

/** Validates bounded lifecycle receipts without provider diagnostics or tool arguments. */
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
