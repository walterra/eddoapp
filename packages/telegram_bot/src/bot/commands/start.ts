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

/**
 * Handle the /status command
 */
export async function handleStatus(ctx: BotContext): Promise<void> {
  const agent = getEddoAgent();
  const agentStatus = await agent.getStatus();
  const connectionInfo = getConnectionInfo();

  // Format date safely for Markdown
  const lastActivity = ctx.session?.lastActivity
    ? new Date(ctx.session.lastActivity)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ')
    : 'Unknown';

  // Escape special characters for Markdown
  const escapeMarkdown = (text: string) =>
    text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

  // Format connection metrics
  const mcpStatusLine = `🔌 MCP Server: ${escapeMarkdown(connectionInfo.state)}`;
  let mcpMetrics = '';

  if (connectionInfo.metrics) {
    const metrics = connectionInfo.metrics;
    const uptimeHours = Math.floor(metrics.totalUptime / 3600000);
    const uptimeMinutes = Math.floor((metrics.totalUptime % 3600000) / 60000);

    mcpMetrics = `
*MCP Connection Metrics:*
• Connection State: ${escapeMarkdown(connectionInfo.state)}
• Connect Attempts: ${metrics.connectAttempts}
• Successful Connections: ${metrics.successfulConnections}
• Failed Connections: ${metrics.failedConnections}
• Total Uptime: ${uptimeHours}h ${uptimeMinutes}m
${metrics.lastConnectionTime ? `• Last Connected: ${escapeMarkdown(metrics.lastConnectionTime.toISOString().slice(0, 19).replace('T', ' '))}` : ''}
${metrics.lastDisconnectionTime ? `• Last Disconnected: ${escapeMarkdown(metrics.lastDisconnectionTime.toISOString().slice(0, 19).replace('T', ' '))}` : ''}`;
  }

  const statusMessage = `🤖 *Bot Status*

✅ Telegram Bot: Online
🔄 Agent: ${escapeMarkdown(agentStatus.workflowType)}
${mcpStatusLine}

*Session Info:*
• User ID: ${escapeMarkdown(ctx.session?.userId || 'Unknown')}
• Last Activity: ${escapeMarkdown(lastActivity)}
• Conversation Active: ${ctx.session?.conversationId ? 'Yes' : 'No'}

*Agent Info:*
• Version: ${escapeMarkdown(agentStatus.version)}
• Workflow: ${escapeMarkdown(agentStatus.workflowType)}
• Uptime: ${Math.floor(agentStatus.uptime / 60)}m ${Math.floor(agentStatus.uptime % 60)}s
• MCP Tools: ${agentStatus.simpleFeatures?.mcpToolsAvailable || 0}
${mcpMetrics}

*Capabilities:*
• Natural Language Processing: ✅
• Todo Management: ✅ \\(via MCP\\)
• Time Tracking: ✅ \\(via MCP\\)
• AI Assistant: ✅ \\(Claude\\)

Everything is running smoothly\\! 🤖`;

  await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
}
