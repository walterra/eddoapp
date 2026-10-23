import type { BotContext } from '../bot.js';

/** Rejects non-private updates before authentication, session access, or command side effects. */
export async function privateChatMiddleware(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  if (ctx.chat?.type === 'private') return next();
  if (!ctx.message?.text) return;
  await ctx.reply(
    'Eddo works only in private chats. Open a private chat with this bot and send your request there. Group messages are not processed.',
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open private chat',
              url: `https://t.me/${ctx.me.username}`,
            },
          ],
        ],
      },
    },
  );
}
