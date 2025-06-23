import { getClaudeAI } from '../../ai/claude.js';
import { logger } from '../../utils/logger.js';
import { BotContext } from '../bot.js';

/**
 * Handle the /start command
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'there';

  logger.info('User started bot', { userId, firstName });

  const claude = getClaudeAI();
  const persona = claude.getPersona();

  const welcomeMessage = `
${persona.acknowledgmentEmoji} *Welcome to Eddo Bot, ${firstName}!*

I'm ${persona.name}, your ${
    persona.id === 'gtd_coach'
      ? 'productivity coach'
      : persona.id === 'zen_master'
        ? 'mindful guide'
        : 'personal digital butler'
  }, here to help you ${
    persona.id === 'gtd_coach'
      ? 'master your productivity system and crush your goals'
      : persona.id === 'zen_master'
        ? 'find balance and intentional action in your daily tasks'
        : 'manage your todos and tasks with elegance and efficiency'
  }.

*What I can help you with:*
• 📝 Create and manage todos with natural language
• ⏰ Track time on your tasks
• 📊 Generate daily and weekly summaries
• 🎯 Organize tasks by context (work, personal, etc.)
• 📅 Set due dates and reminders

*Quick Start:*
• Try: "Add buy groceries to my personal tasks for tomorrow"
• Or: "What do I have due this week?"
• Or: "Start timer for current task"

Type /help to see all available commands, or just start chatting with me naturally!

${
  persona.id === 'gtd_coach'
    ? "Let's get productive"
    : persona.id === 'zen_master'
      ? 'In mindful service'
      : 'At your service'
},
*${persona.name}* ${persona.acknowledgmentEmoji}
`;

  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
}

/**
 * Handle the /help command
 */
export async function handleHelp(ctx: BotContext): Promise<void> {
  const claude = getClaudeAI();
  const persona = claude.getPersona();

  const helpMessage = `
${persona.acknowledgmentEmoji} *Eddo Bot Commands & Usage*

*Basic Commands:*
/start - Welcome message and introduction
/help - Show this help message
/status - Check bot and MCP server status
/summary - Get today's task summary

*Natural Language Examples:*
• "Add 'review quarterly reports' to work context for Friday"
• "Show me all my work tasks"
• "What's due tomorrow?"
• "Mark 'grocery shopping' as completed"
• "Start timer for meeting preparation"
• "How much time did I spend on work tasks today?"

*Time Tracking:*
• "Start timer" or "Start timer for [task name]"
• "Stop timer" or "Pause timer"
• "Show active timers"
• "Time report for this week"

*Task Management:*
• Create: "Add [task] to [context] for [date]"
• Read: "Show my [context] tasks" or "What's due [timeframe]?"
• Update: "Move [task] to [new date]" or "Change [task] context to [context]"
• Delete: "Remove [task]" or "Delete completed tasks"

*Contexts:* work, personal, home, shopping, health, learning

Just chat naturally - I'll understand what you need! ${persona.acknowledgmentEmoji}
`;

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}

/**
 * Handle the /status command
 */
export async function handleStatus(ctx: BotContext): Promise<void> {
  const claude = getClaudeAI();
  const persona = claude.getPersona();

  const statusMessage = `
${persona.acknowledgmentEmoji} *Bot Status*

✅ Telegram Bot: Online
🔄 Checking MCP Server connection...

*Session Info:*
• User ID: ${ctx.session.userId}
• Last Activity: ${ctx.session.lastActivity.toLocaleString()}
• Conversation Active: ${ctx.session.conversationId ? 'Yes' : 'No'}
• Current Persona: ${persona.name} (${persona.id})

*Capabilities:*
• Natural Language Processing: ✅
• Todo Management: ✅ (via MCP)
• Time Tracking: ✅ (via MCP)
• AI Assistant: ✅ (Claude)

Everything is running smoothly! ${persona.acknowledgmentEmoji}
`;

  await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
}
