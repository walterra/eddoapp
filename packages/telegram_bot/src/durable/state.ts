import { defineDoc, type ConversationId, type TaskId } from '@earendil-works/pi-durable';

export const ConversationMap = defineDoc({
  kind: 'eddo.conversations',
  version: 1,
  scope: 'session',
  initial: (): { conversations: Record<string, ConversationId> } => ({ conversations: {} }),
});

export const RequestMap = defineDoc({
  kind: 'eddo.requests',
  version: 1,
  scope: 'session',
  initial: (): { tasks: Record<string, TaskId<string>> } => ({ tasks: {} }),
});

export const RunBudget = defineDoc({
  kind: 'eddo.budget',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'initial',
  initial: (): { input: number; tools: number } => ({ input: 0, tools: 0 }),
});

export type ReportType = 'briefing' | 'recap';

export interface DurableReport {
  type: ReportType;
  occurrence: string;
}

export interface DurableRequestInput {
  requestId: string;
  text: string;
  conversationId: string;
  chatId: number;
  telegramId: number;
  messageId: number;
  createdAt: string;
  deadline: number;
  report?: DurableReport;
}

export type RequestCheckpoint =
  | { phase: 'generate' }
  | {
      phase: 'deliver';
      answer: string;
      offset: number;
      projected: boolean;
      attempts: number;
      printable?: boolean;
      reportType?: ReportType;
    }
  | { phase: 'print'; answer: string; printable: boolean; reportType?: ReportType };
