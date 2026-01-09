/**
 * Email sync module exports
 */
export { createEmailClient, generateExternalId, mapEmailToTodo } from './client.js';
export type { EmailClient, EmailClientOptions, EmailLogger } from './client.js';
export {
  decodeQuotedPrintable,
  extractEmailBody,
  extractPlainText,
  extractSender,
  htmlToMarkdown,
  truncate,
} from './email-parser.js';
export { createOAuthStateManager } from './oauth-state-manager.js';
export type { OAuthStateManager, OAuthStateManagerConfig } from './oauth-state-manager.js';
export { createGoogleOAuthClient, generateOAuthState, maskToken } from './oauth.js';
export type { GoogleOAuthClient, OAuthConfig } from './oauth.js';
export {
  createSyncStats,
  findTodoByExternalId,
  incrementStat,
  processEmail,
} from './sync-helpers.js';
export type { ProcessEmailConfig, ProcessEmailResult, SyncStats } from './sync-helpers.js';
export { createEmailSyncScheduler, shouldSyncUser } from './sync-scheduler.js';
export type { EmailSyncScheduler, EmailSyncSchedulerConfig } from './sync-scheduler.js';
export type {
  EmailItem,
  EmailProvider,
  EmailSyncConfig,
  EmailSyncResult,
  ImapConnectionConfig,
  OAuthState,
  OAuthTokenResponse,
} from './types.js';
