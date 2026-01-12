/**
 * Email Client for fetching emails via IMAP
 * Supports both OAuth2 (Gmail) and plain IMAP authentication
 */
import type { TodoAlpha3 } from '@eddo/core-shared';
import { createHash } from 'crypto';
import { ImapFlow } from 'imapflow';

import { truncate } from './email-parser.js';
import type { MoveResult } from './imap-helpers.js';
import {
  connectWithTimeout,
  createImapOptions,
  ensureFolderExists,
  fetchEmailsFromImap,
  markEmailsAsRead,
  moveEmailsToFolder,
  safeLogout,
} from './imap-helpers.js';
import type { EmailItem, ImapConnectionConfig } from './types.js';

export type { MoveResult } from './imap-helpers.js';

/** Logger interface for email client */
export interface EmailLogger {
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
  debug: (msg: string, meta?: unknown) => void;
}

/** Email client factory configuration */
export interface EmailClientOptions {
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

/** Email client interface */
export interface EmailClient {
  /** Fetch emails from configured folder */
  fetchEmails(config: ImapConnectionConfig, accessToken?: string): Promise<EmailItem[]>;
  /** Mark emails as read by UID */
  markAsRead(config: ImapConnectionConfig, uids: number[], accessToken?: string): Promise<void>;
  /** Move emails to eddo-processed folder */
  moveToProcessed(
    config: ImapConnectionConfig,
    uids: number[],
    accessToken?: string,
  ): Promise<MoveResult>;
  /** Ensure destination folder exists, create if not */
  ensureProcessedFolder(config: ImapConnectionConfig, accessToken?: string): Promise<boolean>;
  /** Map email item to todo */
  mapEmailToTodo(item: EmailItem, tags: string[]): Omit<TodoAlpha3, '_rev'>;
  /** Generate external ID for deduplication */
  generateExternalId(item: EmailItem): string;
}

const DEFAULT_OPTIONS: Required<EmailClientOptions> = {
  timeoutMs: 30000,
};

/** Destination folder for processed emails */
export const PROCESSED_FOLDER = 'eddo-processed';

/**
 * Generates a short hash from a string (first 8 chars of SHA256)
 */
function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').substring(0, 8);
}

/**
 * Generates external ID for email item
 * Format: email:<folder-hash>/<message-id-hash>
 */
export function generateExternalId(item: EmailItem): string {
  const folderHash = shortHash(item.folder);
  const messageHash = shortHash(item.messageId);
  return `email:${folderHash}/${messageHash}`;
}

/**
 * Generates Gmail deep link URL from message ID
 */
function generateGmailLink(gmailMessageId?: string): string | null {
  if (!gmailMessageId) return null;
  const hexId = BigInt(gmailMessageId).toString(16);
  return `https://mail.google.com/mail/u/0/#inbox/${hexId}`;
}

/**
 * Maps email item to TodoAlpha3 structure
 */
export function mapEmailToTodo(item: EmailItem, tags: string[]): Omit<TodoAlpha3, '_rev'> {
  const now = new Date().toISOString();
  const cleanDescription = item.body ? truncate(item.body, 50000) : '';

  return {
    _id: now,
    active: {},
    completed: null,
    context: 'email',
    description: cleanDescription,
    due: item.receivedDate,
    externalId: generateExternalId(item),
    link: generateGmailLink(item.gmailMessageId),
    repeat: null,
    tags,
    title: item.subject || 'No Subject',
    version: 'alpha3',
  };
}

/**
 * Creates fetch emails implementation
 */
function createFetchEmails(options: Required<EmailClientOptions>, logger: EmailLogger) {
  return async (config: ImapConnectionConfig, accessToken?: string): Promise<EmailItem[]> => {
    const folder = config.folder || 'eddo';
    logger.debug('Fetching emails', { folder, provider: config.provider });

    const imapOptions = createImapOptions(config, accessToken);
    const client = new ImapFlow(imapOptions);

    try {
      await connectWithTimeout(client, options.timeoutMs);
      const emails = await fetchEmailsFromImap(client, folder, logger);

      logger.info('Successfully fetched emails', {
        folder,
        provider: config.provider,
        count: emails.length,
      });

      return emails;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to fetch emails', { folder, error: message, stack });
      throw new Error(`Failed to fetch emails: ${message}`);
    } finally {
      await safeLogout(client);
    }
  };
}

/**
 * Creates mark as read implementation
 */
function createMarkAsRead(options: Required<EmailClientOptions>, logger: EmailLogger) {
  return async (
    config: ImapConnectionConfig,
    uids: number[],
    accessToken?: string,
  ): Promise<void> => {
    if (uids.length === 0) return;

    const folder = config.folder || 'eddo';
    const imapOptions = createImapOptions(config, accessToken);
    const client = new ImapFlow(imapOptions);

    try {
      await connectWithTimeout(client, options.timeoutMs);
      await markEmailsAsRead(client, folder, uids, logger);
    } finally {
      await safeLogout(client);
    }
  };
}

/**
 * Creates ensure processed folder implementation
 */
function createEnsureProcessedFolder(options: Required<EmailClientOptions>, logger: EmailLogger) {
  return async (config: ImapConnectionConfig, accessToken?: string): Promise<boolean> => {
    const imapOptions = createImapOptions(config, accessToken);
    const client = new ImapFlow(imapOptions);

    try {
      await connectWithTimeout(client, options.timeoutMs);
      return await ensureFolderExists(client, PROCESSED_FOLDER, logger);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to ensure processed folder', { error: message });
      return false;
    } finally {
      await safeLogout(client);
    }
  };
}

/**
 * Creates move to processed implementation
 */
function createMoveToProcessed(options: Required<EmailClientOptions>, logger: EmailLogger) {
  return async (
    config: ImapConnectionConfig,
    uids: number[],
    accessToken?: string,
  ): Promise<MoveResult> => {
    if (uids.length === 0) return { moved: [], failed: [] };

    const sourceFolder = config.folder || 'eddo';
    const imapOptions = createImapOptions(config, accessToken);
    const client = new ImapFlow(imapOptions);

    try {
      await connectWithTimeout(client, options.timeoutMs);

      const folderReady = await ensureFolderExists(client, PROCESSED_FOLDER, logger);
      if (!folderReady) {
        logger.error('Cannot move emails - failed to ensure destination folder');
        return { moved: [], failed: uids };
      }

      return await moveEmailsToFolder({
        client,
        sourceFolder,
        destFolder: PROCESSED_FOLDER,
        uids,
        logger,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to move emails to processed', { error: message });
      return { moved: [], failed: uids };
    } finally {
      await safeLogout(client);
    }
  };
}

const defaultLogger: EmailLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

/**
 * Creates email client for fetching and processing emails
 */
export function createEmailClient(
  clientOptions: EmailClientOptions = {},
  logger: EmailLogger = defaultLogger,
): EmailClient {
  const options = { ...DEFAULT_OPTIONS, ...clientOptions };

  return {
    fetchEmails: createFetchEmails(options, logger),
    markAsRead: createMarkAsRead(options, logger),
    moveToProcessed: createMoveToProcessed(options, logger),
    ensureProcessedFolder: createEnsureProcessedFolder(options, logger),
    mapEmailToTodo,
    generateExternalId,
  };
}
