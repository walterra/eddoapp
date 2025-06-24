import { z } from 'zod';

export interface AISession {
  id: string;
  userId: string;
  context: Array<{ role: 'user' | 'assistant'; content: string }>;
  createdAt: Date;
  lastActivity: Date;
}

export interface AIResponse {
  content: string;
  usedTools?: string[];
  sessionId?: string;
}

// Schema for structured todo extraction
export const TodoIntentSchema = z.object({
  action: z.enum([
    'create',
    'list',
    'update',
    'complete',
    'delete',
    'start_timer',
    'stop_timer',
    'get_summary',
  ]),
  title: z.string().optional(),
  description: z.string().optional(),
  context: z.string().optional(),
  due: z.string().optional(),
  tags: z.array(z.string()).optional(),
  filters: z
    .object({
      context: z.string().optional(),
      completed: z.boolean().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })
    .optional(),
  todoId: z.string().optional(),
});

// Schema for multiple actions in a single message
export const MultiTodoIntentSchema = z.object({
  actions: z.array(TodoIntentSchema),
  requiresSequential: z.boolean().optional(), // Whether actions must be executed in order
});

export type TodoIntent = z.infer<typeof TodoIntentSchema>;
export type MultiTodoIntent = z.infer<typeof MultiTodoIntentSchema>;