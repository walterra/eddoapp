/**
 * Email sync types for web-api
 * Re-exports shared types and adds web-api specific types
 */

// Re-export shared types
export type { EmailProvider, EmailSyncConfig } from '@eddo/core-shared';

/** Raw email item fetched from IMAP */
export interface EmailItem {
  /** Email subject */
  subject: string;
  /** Email body (plain text) */
  body: string;
  /** Sender email address */
  from: string;
  /** Sender display name */
  fromName?: string;
  /** Email received date as ISO string */
  receivedDate: string;
  /** Message ID from email headers */
  messageId: string;
  /** IMAP UID for marking as read */
  uid: number;
  /** Folder this email came from */
  folder: string;
  /** Gmail message ID for deep linking (X-GM-MSGID) */
  gmailMessageId?: string;
}

/** OAuth token response from Google */
export interface OAuthTokenResponse {
  /** Access token for IMAP */
  accessToken: string;
  /** Refresh token for future access */
  refreshToken?: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** Token type (usually "Bearer") */
  tokenType: string;
}

/** OAuth state for tracking auth flow */
export interface OAuthState {
  /** User ID initiating the OAuth flow */
  userId: string;
  /** Telegram chat ID for callback notification */
  telegramChatId: number;
  /** Random state for CSRF protection */
  state: string;
  /** Timestamp when state was created */
  createdAt: string;
}

/** Result of email sync operation */
export interface EmailSyncResult {
  /** Number of emails fetched */
  fetched: number;
  /** Number of new todos created */
  created: number;
  /** Number of duplicates skipped */
  skipped: number;
  /** Number of errors encountered */
  errors: number;
}

/** IMAP connection configuration for sync operations */
export interface ImapConnectionConfig {
  /** Authentication provider */
  provider: 'gmail' | 'imap';
  /** Gmail OAuth refresh token */
  oauthRefreshToken?: string;
  /** Gmail email address (for user identification) */
  oauthEmail?: string;
  /** IMAP host (for non-OAuth) */
  imapHost?: string;
  /** IMAP port (for non-OAuth, default 993) */
  imapPort?: number;
  /** IMAP username (for non-OAuth, or Gmail email for OAuth) */
  imapUser?: string;
  /** IMAP password (for non-OAuth) */
  imapPassword?: string;
  /** Folder to sync from */
  folder: string;
}
