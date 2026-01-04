/**
 * Email sync module exports
 */
export { createEmailClient, generateExternalId, mapEmailToTodo } from './client.js';
export type { EmailClient, EmailClientConfig, EmailLogger } from './client.js';
export {
  decodeQuotedPrintable,
  extractPlainText,
  extractSender,
  stripHtml,
  truncate,
} from './email-parser.js';
export { createOAuthStateManager } from './oauth-state-manager.js';
export type { OAuthStateManager, OAuthStateManagerConfig } from './oauth-state-manager.js';
export { createGoogleOAuthClient, generateOAuthState, maskToken } from './oauth.js';
export type { GoogleOAuthClient, OAuthConfig } from './oauth.js';
export type {
  EmailItem,
  EmailProvider,
  EmailSyncConfig,
  EmailSyncResult,
  OAuthState,
  OAuthTokenResponse,
} from './types.js';
