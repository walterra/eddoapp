import { getEddoAgent } from '../../agent/index.js';
import { getPersona } from '../../ai/personas.js';
import { getConnectionInfo } from '../../mcp/client.js';
import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { BotContext } from '../bot.js';

/**
 * Handle the /start command
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'there';
  const persona = getPersona(appConfig.BOT_PERSONA_ID);

  logger.info('User started bot', { userId, firstName, persona: persona.id });

  const welcomeMessage = `${persona.acknowledgmentEmoji} *Welcome to Eddo Bot, ${firstName}!*

${persona.messages.welcomeContent}

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

${persona.messages.closingMessage}
`;

  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
}

/**
 * Handle the /help command
 */
export async function handleHelp(ctx: BotContext): Promise<void> {
  const helpMessage = `
🤖 *Eddo Bot Commands & Usage*

*Basic Commands:*
/start - Welcome message and introduction
/help - Show this help message
/status - Check bot status
/link - Link your Telegram account to your web profile
/unlink - Get instructions to unlink your account
/new - Start a fresh assistant conversation

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

Just chat naturally - I'll understand what you need! 🤖
`;

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}

import {
  buildAgentSection,
  buildMcpMetricsSection,
  buildSessionSection,
  escapeMarkdown,
} from './start-helpers.js';

/**
 * Handles /status command to show bot status
 */
export async function handleStatus(ctx: BotContext): Promise<void> {
  const agent = getEddoAgent();
  const agentStatus = await agent.getStatus();
  const connectionInfo = getConnectionInfo();

  const mcpStatusLine = `🔌 MCP Server: ${escapeMarkdown(connectionInfo.state)}`;
  const mcpMetrics = buildMcpMetricsSection(connectionInfo.state, connectionInfo.metrics);
  const sessionSection = buildSessionSection(ctx.session);
  const agentSection = buildAgentSection(agentStatus);

  const statusMessage = `🤖 *Bot Status*

✅ Telegram Bot: Online
🔄 Agent: ${escapeMarkdown(agentStatus.workflowType)}
${mcpStatusLine}

${sessionSection}

${agentSection}
${mcpMetrics}

*Capabilities:*
• Natural Language Processing: ✅
• Todo Management: ✅ \\(via MCP\\)
• Time Tracking: ✅ \\(via MCP\\)
• AI Assistant: ✅ \\(Claude\\)

Everything is running smoothly\\! 🤖`;

  await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
}
