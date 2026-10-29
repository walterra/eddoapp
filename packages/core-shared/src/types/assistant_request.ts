import type { AssistantTelegramMetadata } from './assistant-conversation';

/** Identifies the authenticated account independently of its channel links. */
export interface AssistantAccountIdentity {
  username: string;
}

/** Routes replies to the originating channel without requiring a Telegram link. */
export type AssistantRequestSource =
  | { channel: 'web' }
  | { channel: 'telegram'; telegram: AssistantTelegramMetadata };

export type AssistantReportType = 'briefing' | 'recap';

/** Identifies a scheduled report occurrence. */
export interface AssistantRequestReport {
  type: AssistantReportType;
  occurrence: string;
}

/** Carries server-resolved identity and conversation routing into the assistant host. */
export interface AssistantRequest {
  account: AssistantAccountIdentity;
  requestId: string;
  conversationId: string;
  text: string;
  source: AssistantRequestSource;
  createdAt: string;
  deadline: number;
  report?: AssistantRequestReport;
}
