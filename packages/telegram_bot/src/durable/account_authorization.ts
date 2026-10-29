import { createEnv, createUserRegistry } from '@eddo/core-server';
import type {
  AssistantAccountIdentity,
  AssistantRequest,
  AssistantRequestReport,
  UserPreferences,
} from '@eddo/core-shared';
import type { MCPUserContext } from '../mcp/user-context.js';

export interface AssistantAuthorizationOptions {
  telegramId?: number;
  report?: Pick<AssistantRequestReport, 'type'>;
}

/** Requires current scheduled-report consent and a Telegram delivery identity. */
function authorizeReport(
  preferences: UserPreferences,
  options: AssistantAuthorizationOptions,
): void {
  if (!options.report) return;
  const enabled =
    options.report.type === 'briefing' ? preferences.dailyBriefing : preferences.dailyRecap;
  if (options.telegramId === undefined || !enabled)
    throw new Error('Scheduled report is disabled or missing Telegram authorization');
}

/** Revalidates account status, channel binding, and current MCP credentials without cached sessions. */
export async function resolveAssistantAccount(
  identity: AssistantAccountIdentity,
  options: AssistantAuthorizationOptions = {},
): Promise<MCPUserContext> {
  const env = createEnv();
  const user = await createUserRegistry(env.COUCHDB_URL, env).findByUsername(identity.username);
  if (
    user?.username !== identity.username ||
    user.status !== 'active' ||
    !user.preferences.mcpApiKey
  )
    throw new Error('Assistant account is inactive or missing MCP credentials');
  if (options.telegramId !== undefined && user.telegram_id !== options.telegramId)
    throw new Error('Assistant Telegram identity changed; authorization denied');
  authorizeReport(user.preferences, options);
  return {
    username: user.username,
    mcpApiKey: user.preferences.mcpApiKey,
    ...(options.telegramId !== undefined ? { telegramId: options.telegramId } : {}),
  };
}

/** Checks persisted request identity before resumed generation, tools, or delivery. */
export async function authorizeAssistantRequest(
  identity: AssistantAccountIdentity,
  request: AssistantRequest,
  pinnedTelegramId?: number,
): Promise<MCPUserContext> {
  if (request.account.username !== identity.username)
    throw new Error('Assistant request does not match the journal account');
  const source = request.source;
  if (request.report && source.channel !== 'telegram')
    throw new Error('Scheduled reports require Telegram authorization');
  if (source.channel === 'telegram' && source.telegram.chatId !== source.telegram.userId)
    throw new Error('Assistant requires a private Telegram chat');
  return resolveAssistantAccount(identity, {
    telegramId: source.channel === 'telegram' ? source.telegram.userId : pinnedTelegramId,
    ...(request.report ? { report: request.report } : {}),
  });
}
