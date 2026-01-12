/**
 * IMAP connection and message handling helpers
 */
import { ImapFlow } from 'imapflow';

import type { EmailLogger } from './client.js';
import { extractPlainText, extractSender } from './email-parser.js';
import type { EmailItem, ImapConnectionConfig } from './types.js';

const GMAIL_IMAP_HOST = 'imap.gmail.com';
const GMAIL_IMAP_PORT = 993;

/** IMAP message with envelope */
export interface ImapMessage {
  flags?: Set<string>;
  envelope?: {
    subject?: string;
    date?: Date;
    messageId?: string;
    from?: Array<{ address?: string; name?: string }>;
  };
  source?: Buffer;
  uid: number;
  /** Gmail-specific message ID for deep linking */
  emailId?: string;
}

/**
 * Creates Gmail OAuth IMAP options
 */
function createGmailImapOptions(
  config: ImapConnectionConfig,
  accessToken: string,
): ConstructorParameters<typeof ImapFlow>[0] {
  return {
    host: GMAIL_IMAP_HOST,
    port: GMAIL_IMAP_PORT,
    secure: true,
    logger: {
      debug: (msg: unknown) => console.log('[IMAP DEBUG]', msg),
      info: (msg: unknown) => console.log('[IMAP INFO]', msg),
      warn: (msg: unknown) => console.warn('[IMAP WARN]', msg),
      error: (msg: unknown) => console.error('[IMAP ERROR]', msg),
    },
    auth: {
      user: config.imapUser || config.oauthEmail || '',
      accessToken,
    },
  };
}

/**
 * Creates plain IMAP options
 */
function createPlainImapOptions(
  config: ImapConnectionConfig,
): ConstructorParameters<typeof ImapFlow>[0] {
  return {
    host: config.imapHost || '',
    port: config.imapPort || 993,
    secure: true,
    auth: {
      user: config.imapUser || '',
      pass: config.imapPassword || '',
    },
    logger: false,
  };
}

/**
 * Creates IMAP connection options based on sync config
 */
export function createImapOptions(
  config: ImapConnectionConfig,
  accessToken?: string,
): ConstructorParameters<typeof ImapFlow>[0] {
  if (config.provider === 'gmail' && accessToken) {
    return createGmailImapOptions(config, accessToken);
  }
  return createPlainImapOptions(config);
}

/**
 * Safely logs out from IMAP client
 */
export async function safeLogout(client: ImapFlow): Promise<void> {
  try {
    await client.logout();
  } catch {
    // Ignore logout errors
  }
}

/**
 * Connects to IMAP with timeout
 */
export async function connectWithTimeout(client: ImapFlow, timeoutMs: number): Promise<void> {
  await Promise.race([
    client.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeoutMs),
    ),
  ]);
}

/**
 * Converts IMAP message to EmailItem
 */
export function messageToEmailItem(message: ImapMessage, folder: string): EmailItem | null {
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
    gmailMessageId: message.emailId,
  };
}

/**
 * Processes messages from IMAP fetch iterator
 */
export async function processMessages(
  messages: AsyncGenerator<ImapMessage>,
  folder: string,
): Promise<EmailItem[]> {
  const emails: EmailItem[] = [];
  let totalMessages = 0;
  let skippedNoEnvelope = 0;

  for await (const message of messages) {
    totalMessages++;

    if (!message.envelope) {
      skippedNoEnvelope++;
      continue;
    }

    const emailItem = messageToEmailItem(message, folder);
    if (emailItem) emails.push(emailItem);
  }

  console.log(
    `[EMAIL] Processed ${totalMessages} messages: ${emails.length} kept, ${skippedNoEnvelope} skipped (no envelope)`,
  );

  return emails;
}

/**
 * Fetches emails from IMAP folder with lock
 */
export async function fetchWithLock(client: ImapFlow, folder: string): Promise<EmailItem[]> {
  let lock;
  try {
    lock = await client.getMailboxLock(folder);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Check for common folder-not-found patterns
    if (
      message.includes('Command failed') ||
      message.includes('NO') ||
      message.includes('not exist')
    ) {
      throw new Error(
        `Folder "${folder}" does not exist. Please create a label called "${folder}" in Gmail.`,
      );
    }
    throw error;
  }

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
export async function fetchEmailsFromImap(
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
export async function markEmailsAsRead(
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
 * Ensures destination folder exists, creates if not
 */
export async function ensureFolderExists(
  client: ImapFlow,
  folder: string,
  logger: EmailLogger,
): Promise<boolean> {
  try {
    const mailboxes = await client.list();
    const exists = mailboxes.some((mb) => mb.path === folder);

    if (exists) {
      logger.debug('Folder already exists', { folder });
      return true;
    }

    await client.mailboxCreate(folder);
    logger.info('Created folder', { folder });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to ensure folder exists', { folder, error: message });
    return false;
  }
}

/** Result of move operation */
export interface MoveResult {
  /** UIDs successfully moved */
  moved: number[];
  /** UIDs that failed to move */
  failed: number[];
}

/** Configuration for moving emails */
export interface MoveEmailsConfig {
  client: ImapFlow;
  sourceFolder: string;
  destFolder: string;
  uids: number[];
  logger: EmailLogger;
}

/**
 * Moves emails to destination folder
 */
export async function moveEmailsToFolder(config: MoveEmailsConfig): Promise<MoveResult> {
  const { client, sourceFolder, destFolder, uids, logger } = config;
  const result: MoveResult = { moved: [], failed: [] };

  if (uids.length === 0) return result;

  const lock = await client.getMailboxLock(sourceFolder);
  try {
    const moveResult = await client.messageMove(uids, destFolder, { uid: true });

    if (moveResult) {
      result.moved = uids;
      logger.debug('Moved emails to folder', { sourceFolder, destFolder, count: uids.length });
    } else {
      result.failed = uids;
      logger.warn('Move operation returned false', { sourceFolder, destFolder, uids });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to move emails', { sourceFolder, destFolder, error: message });
    result.failed = uids;
  } finally {
    lock.release();
  }

  return result;
}
