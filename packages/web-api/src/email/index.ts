/**
 * Email sync module exports
 */
export { createEmailClient, generateExternalId, mapEmailToTodo } from './client.js';
export type { EmailClient, EmailClientConfig, EmailLogger } from './client.js';
export type {
  EmailItem,
  EmailProvider,
  EmailSyncConfig,
  EmailSyncResult,
  OAuthState,
  OAuthTokenResponse,
} from './types.js';
