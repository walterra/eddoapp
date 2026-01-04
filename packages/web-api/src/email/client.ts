/**
 * Email Client for fetching emails via IMAP
 * Supports both OAuth2 (Gmail) and plain IMAP authentication
 */
import type { TodoAlpha3 } from '@eddo/core-shared';
import { createHash } from 'crypto';
import { ImapFlow } from 'imapflow';

import { extractPlainText, extractSender, stripHtml, truncate } from './email-parser.js';
import type { EmailItem, EmailSyncConfig } from './types.js';

/** Logger interface for email client */
export interface EmailLogger {
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
  debug: (msg: string, meta?: unknown) => void;
}

/** Email client configuration */
export interface EmailClientConfig {
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

/** Email client interface */
export interface EmailClient {
  /** Fetch unread emails from configured folder */
  fetchEmails(syncConfig: EmailSyncConfig, accessToken?: string): Promise<EmailItem[]>;
  /** Mark emails as read by UID */
  markAsRead(syncConfig: EmailSyncConfig, uids: number[], accessToken?: string): Promise<void>;
  /** Map email item to todo */
  mapEmailToTodo(item: EmailItem, tags: string[]): Omit<TodoAlpha3, '_rev'>;
  /** Generate external ID for deduplication */
  generateExternalId(item: EmailItem): string;
}

const DEFAULT_CONFIG: Required<EmailClientConfig> = {
  timeoutMs: 30000,
};

const GMAIL_IMAP_HOST = 'imap.gmail.com';
const GMAIL_IMAP_PORT = 993;

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
 * Creates Gmail OAuth IMAP options
 */
function createGmailImapOptions(
  syncConfig: EmailSyncConfig,
  accessToken: string,
): ConstructorParameters<typeof ImapFlow>[0] {
  return {
    host: GMAIL_IMAP_HOST,
    port: GMAIL_IMAP_PORT,
    secure: true,
    auth: {
      user: syncConfig.imapUser || '',
      accessToken,
    },
    logger: false,
  };
}

/**
 * Creates plain IMAP options
 */
function createPlainImapOptions(
  syncConfig: EmailSyncConfig,
): ConstructorParameters<typeof ImapFlow>[0] {
  return {
    host: syncConfig.imapHost || '',
    port: syncConfig.imapPort || 993,
    secure: true,
    auth: {
      user: syncConfig.imapUser || '',
      pass: syncConfig.imapPassword || '',
    },
    logger: false,
  };
}

/**
 * Creates IMAP connection options based on sync config
 */
function createImapOptions(
  syncConfig: EmailSyncConfig,
  accessToken?: string,
): ConstructorParameters<typeof ImapFlow>[0] {
  if (syncConfig.provider === 'gmail' && accessToken) {
    return createGmailImapOptions(syncConfig, accessToken);
  }
  return createPlainImapOptions(syncConfig);
}

/**
 * Maps email item to TodoAlpha3 structure
 */
export function mapEmailToTodo(item: EmailItem, tags: string[]): Omit<TodoAlpha3, '_rev'> {
  const now = new Date().toISOString();
  const cleanDescription = item.body ? truncate(stripHtml(item.body), 2000) : '';

  return {
    _id: now,
    active: {},
    completed: null,
    context: 'email',
    description: cleanDescription,
    due: item.receivedDate,
    externalId: generateExternalId(item),
    link: null,
    repeat: null,
    tags,
    title: item.subject || 'No Subject',
    version: 'alpha3',
  };
}

/** IMAP message with envelope */
interface ImapMessage {
  flags?: Set<string>;
  envelope?: {
    subject?: string;
    date?: Date;
    messageId?: string;
    from?: Array<{ address?: string; name?: string }>;
  };
  source?: Buffer;
  uid: number;
}

/**
 * Converts IMAP message to EmailItem
 */
function messageToEmailItem(message: ImapMessage, folder: string): EmailItem | null {
  if (!message.envelope) return null;

  const { from, fromName } = extractSender(message.envelope);
  const body = message.source ? extractPlainText(message.source) : '';

  return {
    subject: message.envelope.subject || 'No Subject',
    body,
    from,
    fromName,
    receivedDate: message.envelope.date?.toISOString() || new Date().toISOString(),
    messageId: message.envelope.messageId || `${message.uid}@unknown`,
    uid: message.uid,
    folder,
  };
}

/**
 * Checks if message should be skipped (already read or no envelope)
 */
function shouldSkipMessage(message: ImapMessage): boolean {
  return message.flags?.has('\\Seen') === true || !message.envelope;
}

/**
 * Processes messages from IMAP fetch iterator
 */
async function processMessages(
  messages: AsyncGenerator<ImapMessage>,
  folder: string,
): Promise<EmailItem[]> {
  const emails: EmailItem[] = [];

  for await (const message of messages) {
    if (shouldSkipMessage(message)) continue;

    const emailItem = messageToEmailItem(message, folder);
    if (emailItem) emails.push(emailItem);
  }

  return emails;
}

/**
 * Fetches emails from IMAP folder with lock
 */
async function fetchWithLock(client: ImapFlow, folder: string): Promise<EmailItem[]> {
  const lock = await client.getMailboxLock(folder);
  try {
    const messages = client.fetch('1:*', {
      envelope: true,
      source: true,
      flags: true,
      uid: true,
    }) as AsyncGenerator<ImapMessage>;

    return await processMessages(messages, folder);
  } finally {
    lock.release();
  }
}

/**
 * Fetches emails from IMAP folder
 */
async function fetchEmailsFromImap(
  client: ImapFlow,
  folder: string,
  logger: EmailLogger,
): Promise<EmailItem[]> {
  try {
    const emails = await fetchWithLock(client, folder);
    logger.debug('Fetched emails from folder', { folder, count: emails.length });
    return emails;
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      logger.warn('Email folder does not exist', { folder });
      return [];
    }
    throw error;
  }
}

/**
 * Marks emails as read by UID
 */
async function markEmailsAsRead(
  client: ImapFlow,
  folder: string,
  uids: number[],
  logger: EmailLogger,
): Promise<void> {
  if (uids.length === 0) return;

  const lock = await client.getMailboxLock(folder);
  try {
    await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true });
    logger.debug('Marked emails as read', { folder, count: uids.length });
  } finally {
    lock.release();
  }
}

/**
 * Safely logs out from IMAP client
 */
async function safeLogout(client: ImapFlow): Promise<void> {
  try {
    await client.logout();
  } catch {
    // Ignore logout errors
  }
}

/**
 * Connects to IMAP with timeout
 */
async function connectWithTimeout(client: ImapFlow, timeoutMs: number): Promise<void> {
  await Promise.race([
    client.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeoutMs),
    ),
  ]);
}

/**
 * Creates fetch emails implementation
 */
function createFetchEmails(config: Required<EmailClientConfig>, logger: EmailLogger) {
  return async (syncConfig: EmailSyncConfig, accessToken?: string): Promise<EmailItem[]> => {
    const folder = syncConfig.folder || 'Eddo';
    logger.debug('Fetching emails', { folder, provider: syncConfig.provider });

    const imapOptions = createImapOptions(syncConfig, accessToken);
    const client = new ImapFlow(imapOptions);

    try {
      await connectWithTimeout(client, config.timeoutMs);
      const emails = await fetchEmailsFromImap(client, folder, logger);

      logger.info('Successfully fetched emails', {
        folder,
        provider: syncConfig.provider,
        count: emails.length,
      });

      return emails;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch emails', { folder, error: message });
      throw new Error(`Failed to fetch emails: ${message}`);
    } finally {
      await safeLogout(client);
    }
  };
}

/**
 * Creates mark as read implementation
 */
function createMarkAsRead(logger: EmailLogger) {
  return async (
    syncConfig: EmailSyncConfig,
    uids: number[],
    accessToken?: string,
  ): Promise<void> => {
    if (uids.length === 0) return;

    const folder = syncConfig.folder || 'Eddo';
    const imapOptions = createImapOptions(syncConfig, accessToken);
    const client = new ImapFlow(imapOptions);

    try {
      await client.connect();
      await markEmailsAsRead(client, folder, uids, logger);
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
  clientConfig: EmailClientConfig = {},
  logger: EmailLogger = defaultLogger,
): EmailClient {
  const config = { ...DEFAULT_CONFIG, ...clientConfig };

  return {
    fetchEmails: createFetchEmails(config, logger),
    markAsRead: createMarkAsRead(logger),
    mapEmailToTodo,
    generateExternalId,
  };
}
