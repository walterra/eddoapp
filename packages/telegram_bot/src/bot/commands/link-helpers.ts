/**
 * Helper functions for link command
 */
import { logger } from '../../utils/logger.js';

/** Help message shown when /link is called without a code */
export const LINK_HELP_MESSAGE = `🔗 *Account Linking*

To link your Telegram account with your Eddo web account:

1. 🌐 Log in to your Eddo web app
2. 👤 Go to your Profile Settings
3. 📋 Navigate to the "Integrations" tab
4. 🔑 Generate a linking code
5. 📝 Use this command with your code: \`/link YOUR_CODE\`

Example: \`/link ABC123DEF456\`

*Why link your account?*
• 🔄 Sync todos between web and Telegram
• 📊 Access your personal todo database
• ⚡ Seamless experience across platforms

Need help? Contact support or check the web app documentation.`;

/** Success message template */
export function getSuccessMessage(firstName: string, username: string): string {
  return `✅ *Account Successfully Linked!*

🎉 Welcome, ${firstName}! Your Telegram account is now linked to user: *${username}*

*What's next?*
• 📝 Your todos will now sync with your web account
• 🔄 Changes made here will appear in your web app
• 📊 Access your personal todo database through our bot
• ⚡ Enjoy seamless productivity across platforms!

*Quick Start:*
• Try: "Show me my work tasks"
• Or: "Add buy milk to my personal context"
• Or: "What's due this week?"

Type /help to see all available commands, or just start chatting naturally! 🤖`;
}

/** Connection error message */
export const CONNECTION_ERROR_MESSAGE = `❌ *Connection Error*

Unable to connect to the linking service. This might be a temporary issue.

🔄 Please try again in a few moments, or contact support if the problem persists.`;

/**
 * Get error message based on response status
 */
export function getErrorMessage(status: number, errorText?: string): string {
  let errorMessage = '❌ *Linking Failed*\n\n';

  if (status === 400) {
    errorMessage += 'The linking code is invalid or has expired.\n\n';
    errorMessage += '🔄 Please generate a new code from your web profile and try again.';
  } else if (status === 409) {
    errorMessage += 'This Telegram account is already linked to another user.\n\n';
    errorMessage += '📞 If this is an error, please contact support.';
  } else {
    errorMessage += `${errorText || 'Unknown error occurred'}\n\n`;
    errorMessage += '🔄 Please try again or contact support if the problem persists.';
  }

  return errorMessage;
}

/** Unlink help message */
export const UNLINK_MESSAGE = `🔗 *Account Unlinking*

To unlink your Telegram account from your Eddo web account:

1. 🌐 Log in to your Eddo web app
2. 👤 Go to your Profile Settings  
3. 📋 Navigate to the "Integrations" tab
4. ❌ Click "Unlink" next to your Telegram connection

*After unlinking:*
• ❌ Todos will no longer sync between web and Telegram
• 📱 You'll need to use /link again to reconnect
• 🗃️ Your web account data remains safe and unchanged

*Need to link a different account?*
Unlink first, then use /link with a new code from the desired account.

Type /help for more commands or start chatting! 🤖`;

/**
 * Extract link code from message text
 * @returns Link code or null if not provided
 */
export function extractLinkCode(messageText: string): string | null {
  const parts = messageText.split(' ');
  if (parts.length < 2) {
    return null;
  }
  const code = parts[1].trim();
  return code || null;
}

/**
 * Log successful linking
 */
export function logLinkSuccess(
  userId: number | undefined,
  username: string,
  linkCode: string,
): void {
  logger.info('Account successfully linked', { userId, username, linkCode });
}

/**
 * Log linking failure
 */
export function logLinkFailure(
  userId: number | undefined,
  linkCode: string,
  status: number,
  error?: string,
): void {
  logger.warn('Account linking failed', { userId, linkCode, status, error });
}

/**
 * Log linking error
 */
export function logLinkError(error: unknown, userId: number | undefined, linkCode: string): void {
  logger.error('Error during account linking', {
    error: error instanceof Error ? error.message : String(error),
    userId,
    linkCode,
  });
}
