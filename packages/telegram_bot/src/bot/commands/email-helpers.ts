/**
 * Helper functions for email sync commands
 */
import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { EmailSyncConfig } from '@eddo/core-shared';

import { logger } from '../../utils/logger.js';
import { invalidateUserCache, TelegramUser } from '../../utils/user-lookup.js';

/**
 * Update user preferences for email sync
 */
export async function updateEmailPreferences(
  user: TelegramUser,
  updates: Record<string, unknown>,
): Promise<void> {
  const env = createEnv();
  const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

  await userRegistry.update(user._id, {
    preferences: { ...user.preferences, ...updates },
    updated_at: new Date().toISOString(),
  });

  invalidateUserCache(user.telegram_id);
}

/**
 * Format last sync date for display
 */
export function formatLastSync(lastSync: string | undefined): string {
  if (!lastSync) return 'Never';

  return new Date(lastSync).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Mask email for display (show first 3 and domain)
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 3 ? local.substring(0, 3) + '***' : '***';
  return `${maskedLocal}@${domain}`;
}

/**
 * Build email help message
 */
export function buildHelpMessage(isEnabled: boolean, isConfigured: boolean): string {
  const configStatus = isConfigured ? '✅ Configured' : '❌ Not configured';
  const syncStatus = isEnabled ? '✅ Enabled' : '❌ Disabled';

  return (
    '📧 **Email to Todo Sync**\n\n' +
    '**Commands:**\n' +
    '`/email auth` - Connect your Gmail account\n' +
    '`/email on` - Enable automatic sync\n' +
    '`/email off` - Disable automatic sync\n' +
    '`/email folder <name>` - Set IMAP folder (default: Eddo)\n' +
    '`/email status` - Show current settings\n' +
    '`/email` - Show this help\n\n' +
    '**Current Status:**\n' +
    `📬 Account: ${configStatus}\n` +
    `🔄 Sync: ${syncStatus}\n\n` +
    '**How it works:**\n' +
    '1. Connect your Gmail account with `/email auth`\n' +
    '2. Create a label called "Eddo" in Gmail\n' +
    '3. Enable sync with `/email on`\n' +
    '4. Emails in your "Eddo" label become todos\n' +
    '5. Synced emails are marked as read'
  );
}

interface EmailSyncPrefs {
  isEnabled: boolean;
  isConfigured: boolean;
  provider: string | undefined;
  email: string | undefined;
  folder: string;
  syncInterval: number;
  tags: string[];
  lastSync: string | undefined;
}

/**
 * Check if email config is properly configured
 */
function isEmailConfigured(config: EmailSyncConfig | undefined): boolean {
  if (!config) return false;
  return config.oauthRefreshToken != null || config.imapUser != null;
}

/**
 * Get email address from config
 */
function getEmailFromConfig(config: EmailSyncConfig | undefined): string | undefined {
  if (!config) return undefined;
  return config.oauthEmail || config.imapUser;
}

const DEFAULT_EMAIL_FOLDER = 'Eddo';
const DEFAULT_SYNC_INTERVAL = 15;
const DEFAULT_EMAIL_TAGS = ['source:email', 'gtd:next'];

/**
 * Build base preferences with defaults
 */
function buildBasePrefs(
  prefs: TelegramUser['preferences'],
): Omit<EmailSyncPrefs, 'isConfigured' | 'provider' | 'email'> {
  return {
    isEnabled: prefs?.emailSync === true,
    folder: prefs?.emailFolder ?? DEFAULT_EMAIL_FOLDER,
    syncInterval: prefs?.emailSyncInterval ?? DEFAULT_SYNC_INTERVAL,
    tags: prefs?.emailSyncTags ?? DEFAULT_EMAIL_TAGS,
    lastSync: prefs?.emailLastSync,
  };
}

/**
 * Extract email sync preferences from user
 */
export function extractEmailPrefs(user: TelegramUser): EmailSyncPrefs {
  const prefs = user.preferences;
  const config = prefs?.emailConfig as EmailSyncConfig | undefined;
  const basePrefs = buildBasePrefs(prefs);

  return {
    ...basePrefs,
    isConfigured: isEmailConfigured(config),
    provider: config?.provider,
    email: getEmailFromConfig(config),
  };
}

/**
 * Get status footer text based on configuration state
 */
function getStatusFooterText(isEnabled: boolean, isConfigured: boolean): string {
  if (!isConfigured) {
    return '📭 Email not configured.\n\nUse `/email auth` to connect your Gmail account.';
  }
  if (isEnabled) {
    return '🔄 Email sync is active. New emails will be synced automatically.';
  }
  return '📵 Email sync is disabled.\n\nUse `/email on` to enable it.';
}

/**
 * Builds status message for email sync configuration
 */
export function buildStatusMessage(user: TelegramUser): string {
  const prefs = extractEmailPrefs(user);
  const statusEmoji = prefs.isEnabled ? '✅' : '❌';
  const statusText = prefs.isEnabled ? 'Enabled' : 'Disabled';
  const accountText = prefs.email ? maskEmail(prefs.email) : 'Not connected';
  const providerText = prefs.provider === 'gmail' ? 'Gmail (OAuth)' : prefs.provider || 'None';

  return (
    '📊 **Email Sync Status**\n\n' +
    `${statusEmoji} **Status:** ${statusText}\n` +
    `📬 **Account:** ${accountText}\n` +
    `🔐 **Provider:** ${providerText}\n` +
    `📁 **Folder:** ${prefs.folder}\n` +
    `⏱ **Interval:** Every ${prefs.syncInterval} minutes\n` +
    `🏷 **Tags:** ${prefs.tags.join(', ')}\n` +
    `📁 **Context:** email\n` +
    `🕰 **Last sync:** ${formatLastSync(prefs.lastSync)}\n\n` +
    getStatusFooterText(prefs.isEnabled, prefs.isConfigured)
  );
}

// Singleton state manager for OAuth flow tracking
let oauthStateManager: Awaited<
  ReturnType<typeof import('@eddo/web-api/email').createOAuthStateManager>
> | null = null;

/**
 * Get or create OAuth state manager singleton
 */
export async function getOAuthStateManager() {
  if (!oauthStateManager) {
    const { createOAuthStateManager } = await import('@eddo/web-api/email');
    oauthStateManager = createOAuthStateManager();
  }
  return oauthStateManager;
}

/**
 * Generate OAuth authorization URL for Gmail
 */
export async function generateGmailAuthUrl(
  userId: string,
  telegramChatId: number,
): Promise<string | null> {
  try {
    const { createGoogleOAuthClient } = await import('@eddo/web-api/email');
    const env = createEnv();

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      logger.error('Google OAuth not configured');
      return null;
    }

    const oauthClient = createGoogleOAuthClient({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    });

    // Create state for CSRF protection
    const stateManager = await getOAuthStateManager();
    const state = stateManager.create(userId, telegramChatId);

    return oauthClient.generateAuthUrl(state.state);
  } catch (error) {
    logger.error('Failed to generate Gmail auth URL', { error });
    return null;
  }
}

/**
 * Validate folder name
 */
export function validateFolderName(folder: string): { valid: boolean; error?: string } {
  if (!folder || folder.trim().length === 0) {
    return { valid: false, error: '❌ Folder name cannot be empty.' };
  }

  if (folder.length > 100) {
    return { valid: false, error: '❌ Folder name is too long (max 100 characters).' };
  }

  // Basic validation - no special characters that might cause issues
  if (!/^[a-zA-Z0-9_\-\s/]+$/.test(folder)) {
    return {
      valid: false,
      error:
        '❌ Folder name contains invalid characters. Use letters, numbers, spaces, -, _, or /.',
    };
  }

  return { valid: true };
}
