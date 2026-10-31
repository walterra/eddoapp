import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { parseLlmSettings } from '@eddo/assistant-server/llm_options';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { Bot } from 'grammy';
import { openCouchDbStorage } from 'pi-durable-couchdb';
import { resolveConfiguredModel } from '../ai/llm-model-resolution.js';
import type { BotContext } from '../bot/bot.js';
import { getMCPClient, scopeMCPIntegration } from '../mcp/client.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { resolveAssistantAccount } from './account_authorization.js';
import { openAssistantRuntime } from './assistant_runtime.js';
import { provisionDurableDatabase } from './couch.js';
import { createHostProjection } from './host_projection.js';
import { loadLegacyArchive, loadLegacyHistory } from './legacy_history.js';
import { loadMemoryContext } from './memory_context.js';
import { buildDurablePrompt } from './prompt.js';
import { printDurableReport } from './report_delivery.js';
import type { DurableRuntimeOptions } from './runtime.js';
import { sendTelegramText } from './telegram_send.js';

const models = builtinModels();

/** Validates provider credentials before starting recovery or internal admission. */
export async function validateHostModel(): Promise<void> {
  const model = resolveConfiguredModel(appConfig.LLM_MODEL, models);
  if (!(await models.getAuth(model.provider)))
    throw new Error(`LLM credentials are required for provider "${model.provider}"`);
}

/** Revalidates identity before loading either the preview or complete original archive. */
function legacyLoaders(
  username: string,
  telegramId?: number,
): Pick<DurableRuntimeOptions, 'legacyArchive' | 'legacyHistory'> {
  return {
    legacyArchive: async (conversationId) => {
      await resolveAssistantAccount({ username }, { telegramId });
      return loadLegacyArchive(username, conversationId);
    },
    legacyHistory: async (conversationId) => {
      await resolveAssistantAccount({ username }, { telegramId });
      return loadLegacyHistory(username, conversationId);
    },
  };
}

/** Opens a user's private runtime using current registry identity and server credentials. */
export async function openUserRuntime(
  username: string,
  bot?: Bot<BotContext>,
): Promise<DurableRuntime> {
  const env = createEnv();
  const user = await createUserRegistry(env.COUCHDB_URL, env).findByUsername(username);
  if (!user || user.status !== 'active') throw new Error('Durable user is inactive');
  const telegramId = user.telegram_id;
  const identity = await resolveAssistantAccount({ username }, { telegramId });
  const dispatcher = getMCPClient();
  if (!dispatcher) throw new Error('MCP is not initialized');
  const client = await scopeMCPIntegration(dispatcher, identity);
  const model = resolveConfiguredModel(appConfig.LLM_MODEL, models);
  if (!models.getModel(model.provider, model.modelId) || !(await models.getAuth(model.provider))) {
    throw new Error('Durable model is unknown or missing provider credentials');
  }
  const endpoint = await provisionDurableDatabase(username);
  const storage = await openCouchDbStorage(endpoint);
  try {
    return await openAssistantRuntime({
      storage,
      models,
      client,
      username,
      telegramId,
      model,
      generation: parseLlmSettings(),
      instructions: buildDurablePrompt(appConfig.BOT_PERSONA_ID),
      memoryContext: async () =>
        loadMemoryContext(client, await resolveAssistantAccount({ username }, { telegramId })),
      ...legacyLoaders(username, telegramId),
      send: (chatId, text, options) => {
        if (!bot) throw new Error('Telegram delivery adapter is unavailable');
        return sendTelegramText(bot.api, chatId, text, options);
      },
      progress:
        bot && telegramId !== undefined
          ? (text) => bot.api.sendMessage(telegramId, text)
          : undefined,
      print: (input, answer, reportType) => printDurableReport(username, input, answer, reportType),
      ...createHostProjection(username),
      onReport: (error) => logger.error('Durable runtime reported an error', { username, error }),
    });
  } catch (error) {
    await storage.close(context);
    throw error;
  }
}
