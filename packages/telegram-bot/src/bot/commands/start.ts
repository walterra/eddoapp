import { approvalManager } from '../../agent/approval-manager.js';
import { getEddoAgent } from '../../agent/index.js';
import { workflowStateManager } from '../../agent/workflow-state-manager.js';
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
  const persona = claude.getCurrentPersona();

  const welcomeMessage = `
${persona.acknowledgmentEmoji} *Welcome to Eddo Bot, ${firstName}!*

I'm ${persona.name}, your ${persona.messages.roleDescription}, here to help you ${persona.messages.welcomeContent}.

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

${persona.messages.closingMessage},
*${persona.name}* ${persona.acknowledgmentEmoji}
`;

  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
}

/**
 * Handle the /help command
 */
export async function handleHelp(ctx: BotContext): Promise<void> {
  const claude = getClaudeAI();
  const persona = claude.getCurrentPersona();

  const helpMessage = `
${persona.acknowledgmentEmoji} *Eddo Bot Commands & Usage*

*Basic Commands:*
/start - Welcome message and introduction
/help - Show this help message
/status - Check bot and MCP server status
/approve - Approve pending workflow step
/deny - Deny pending workflow step
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
  const persona = claude.getCurrentPersona();

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

/**
 * Handle the /approve command
 */
export async function handleApprove(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id?.toString();

  if (!userId) {
    await ctx.reply('❌ Unable to identify user for approval.');
    return;
  }

  const pendingRequests = approvalManager.getPendingRequests(userId);

  if (pendingRequests.length === 0) {
    await ctx.reply('ℹ️ No pending approval requests found.');
    return;
  }

  // Approve the most recent request
  const approvedRequest = approvalManager.approveRequest(userId);

  if (approvedRequest) {
    await ctx.reply(
      `✅ APPROVED: ${approvedRequest.stepId}\n\nContinuing workflow execution...`,
    );
    logger.info('User approved request via command', {
      userId,
      requestId: approvedRequest.id,
      stepId: approvedRequest.stepId,
    });

    // Check if there's a paused workflow to resume
    if (workflowStateManager.hasPausedWorkflow(userId)) {
      // Trigger workflow resumption by sending a special resume message
      try {
        const agent = getEddoAgent({
          enableStreaming: true,
          enableApprovals: true,
          maxExecutionTime: 300000,
        });

        // Process a special resume message to trigger workflow continuation
        const result = await agent.processMessage(
          '__RESUME_WORKFLOW__', // Special internal message
          userId,
          ctx,
        );

        if (!result.success) {
          logger.error('Failed to resume workflow after approval', {
            userId,
            error: result.finalState.error,
          });
          await ctx.reply(
            '⚠️ Failed to resume workflow. Please try running your original command again.',
          );
        }
      } catch (error) {
        logger.error('Error during workflow resumption', { userId, error });
        await ctx.reply(
          '⚠️ Error resuming workflow. Please try running your original command again.',
        );
      }
    } else {
      await ctx.reply(
        '💡 No paused workflow found. Please run your original command again if needed.',
      );
    }
  } else {
    await ctx.reply('❌ Failed to approve request.');
  }
}

/**
 * Handle the /deny command
 */
export async function handleDeny(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id?.toString();

  if (!userId) {
    await ctx.reply('❌ Unable to identify user for denial.');
    return;
  }

  const pendingRequests = approvalManager.getPendingRequests(userId);

  if (pendingRequests.length === 0) {
    await ctx.reply('ℹ️ No pending approval requests found.');
    return;
  }

  // Deny the most recent request
  const deniedRequest = approvalManager.denyRequest(userId);

  if (deniedRequest) {
    await ctx.reply(
      `❌ DENIED: ${deniedRequest.stepId}\n\nThe step has been skipped.`,
    );
    logger.info('User denied request via command', {
      userId,
      requestId: deniedRequest.id,
      stepId: deniedRequest.stepId,
    });
  } else {
    await ctx.reply('❌ Failed to deny request.');
  }
}
