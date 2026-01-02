import type { BotContext } from '../bot.js';

/**
 * Generates instructions for linking Telegram account to Eddo
 * @param userId - Telegram user ID to display
 * @returns Formatted linking instructions string
 */
export function generateLinkingInstructions(userId: number): string {
  return (
    `📱 Your Telegram ID: ${userId}\n\n` +
    '🔗 To link your account:\n' +
    '1. Go to the web app and log in\n' +
    '2. Click "Profile" in the header\n' +
    '3. Go to "Integrations" tab\n' +
    '4. Enter your Telegram ID above\n' +
    '5. Follow the linking instructions\n\n'
  );
}

/**
 * Extracts user details for logging when enabled
 * @param ctx - Bot context
 * @param logUserDetails - Whether to include user details
 * @returns User details object or empty object
 */
export function extractUserDetails(
  ctx: BotContext,
  logUserDetails: boolean,
): Record<string, string | undefined> {
  if (!logUserDetails) {
    return {};
  }
  return {
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
    lastName: ctx.from?.last_name,
  };
}

/**
 * Builds the rate limited response message
 * @param userId - Telegram user ID
 * @returns Formatted rate limit message
 */
export function buildRateLimitedMessage(userId: number): string {
  return (
    '⏰ Too many unauthorized attempts. Please wait 15 minutes before trying again.\n\n' +
    generateLinkingInstructions(userId) +
    'If you believe this is an error, please contact the bot administrator.'
  );
}

/**
 * Builds the rate limit exceeded response message
 * @param userId - Telegram user ID
 * @returns Formatted rate limit exceeded message
 */
export function buildRateLimitExceededMessage(userId: number): string {
  return (
    '🚫 Too many unauthorized attempts. Access has been temporarily restricted.\n\n' +
    generateLinkingInstructions(userId) +
    'Please wait 15 minutes before trying again. If you believe this is an error, please contact the bot administrator.'
  );
}

/**
 * Builds the unauthorized response message with remaining attempts
 * @param userId - Telegram user ID
 * @param remainingAttempts - Number of attempts remaining
 * @returns Formatted unauthorized message
 */
export function buildUnauthorizedMessage(userId: number, remainingAttempts: number): string {
  return (
    '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
    generateLinkingInstructions(userId) +
    `${remainingAttempts} attempts remaining before temporary restriction.\n\n` +
    'If you believe this is an error, please contact the bot administrator.'
  );
}
