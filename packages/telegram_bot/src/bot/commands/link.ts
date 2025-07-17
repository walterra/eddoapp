import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { BotContext } from '../bot.js';

/**
 * Handle the /link command to link Telegram account to web user
 */
export async function handleLink(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'User';

  logger.info('User requested account linking', { userId, firstName });

  // Extract the link code from the command arguments
  const messageText = ctx.message?.text || '';
  const parts = messageText.split(' ');

  if (parts.length < 2) {
    const linkMessage = `🔗 *Account Linking*

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

    await ctx.reply(linkMessage, { parse_mode: 'Markdown' });
    return;
  }

  const linkCode = parts[1].trim();

  if (!linkCode) {
    await ctx.reply(
      'Please provide a valid linking code. Use: `/link YOUR_CODE`',
      {
        parse_mode: 'Markdown',
      },
    );
    return;
  }

  try {
    // Call the web API to link the account
    const response = await fetch(
      `${appConfig.WEB_API_BASE_URL}/api/auth/link-telegram`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkCode,
          telegramId: userId,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      logger.warn('Account linking failed', {
        userId,
        linkCode,
        status: response.status,
        error: data.error,
      });

      let errorMessage = '❌ *Linking Failed*\n\n';

      if (response.status === 400) {
        errorMessage += 'The linking code is invalid or has expired.\n\n';
        errorMessage +=
          '🔄 Please generate a new code from your web profile and try again.';
      } else if (response.status === 409) {
        errorMessage +=
          'This Telegram account is already linked to another user.\n\n';
        errorMessage += '📞 If this is an error, please contact support.';
      } else {
        errorMessage += `${data.error || 'Unknown error occurred'}\n\n`;
        errorMessage +=
          '🔄 Please try again or contact support if the problem persists.';
      }

      await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
      return;
    }

    logger.info('Account successfully linked', {
      userId,
      username: data.username,
      linkCode,
    });

    const successMessage = `✅ *Account Successfully Linked!*

🎉 Welcome, ${firstName}! Your Telegram account is now linked to user: *${data.username}*

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

    await ctx.reply(successMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error during account linking', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      linkCode,
    });

    const errorMessage = `❌ *Connection Error*

Unable to connect to the linking service. This might be a temporary issue.

🔄 Please try again in a few moments, or contact support if the problem persists.`;

    await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
  }
}

/**
 * Handle the /unlink command to unlink Telegram account
 */
export async function handleUnlink(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'User';

  logger.info('User requested account unlinking', { userId, firstName });

  const unlinkMessage = `🔗 *Account Unlinking*

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

  await ctx.reply(unlinkMessage, { parse_mode: 'Markdown' });
}
