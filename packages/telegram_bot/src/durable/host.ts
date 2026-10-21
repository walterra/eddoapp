import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { Bot } from 'grammy';
import { openCouchDbStorage } from 'pi-durable-couchdb';
import { resolveConfiguredModel } from '../ai/llm-model-resolution.js';
import { parseLlmSettings } from '../ai/llm-options.js';
import type { BotContext } from '../bot/bot.js';
import { getMCPClient } from '../mcp/client.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { provisionDurableDatabase } from './couch.js';
import { loadLegacyHistory } from './legacy_history.js';
import { loadMemoryContext } from './memory_context.js';
import { projectDurableExchange } from './projection.js';
import { buildDurablePrompt } from './prompt.js';
import { printDurableReport } from './report_delivery.js';
import { openDurableRuntime, type DurableRuntime } from './runtime.js';
import type { DurableRequestInput, ReportType } from './state.js';
import { authorizeDurableRequest, resolveDurableUser } from './tools.js';

const runtimes = new Map<string, Promise<DurableRuntime>>();
const models = builtinModels();
let bot: Bot<BotContext> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let stopping = false;

/** Opens a user's private runtime using current registry identity and server credentials. */
async function openUserRuntime(username: string): Promise<DurableRuntime> {
  if (!bot || stopping) throw new Error('Durable host is not running');
  const env = createEnv();
  const user = await createUserRegistry(env.COUCHDB_URL, env).findByUsername(username);
  if (!user?.telegram_id || user.status !== 'active')
    throw new Error('Durable user is inactive or unlinked');
  const telegramId = user.telegram_id;
  await resolveDurableUser(username, telegramId);
  const client = getMCPClient();
  if (!client) throw new Error('MCP is not initialized');
  const model = resolveConfiguredModel(appConfig.LLM_MODEL, models);
  if (!models.getModel(model.provider, model.modelId) || !(await models.getAuth(model.provider))) {
    throw new Error('Durable model is unknown or missing provider credentials');
  }
  const endpoint = await provisionDurableDatabase(username);
  const storage = await openCouchDbStorage(endpoint);
  let projection = Promise.resolve();
  try {
    return await openDurableRuntime({
      storage,
      models,
      client,
      username,
      telegramId,
      model,
      generation: parseLlmSettings(),
      instructions: buildDurablePrompt(appConfig.BOT_PERSONA_ID),
      memoryContext: async () =>
        loadMemoryContext(client, await resolveDurableUser(username, telegramId)),
      legacyHistory: async (conversationId) => {
        await resolveDurableUser(username, telegramId);
        return loadLegacyHistory(username, conversationId);
      },
      authorize: (input) => authorizeDurableRequest(username, telegramId, input),
      send: (chatId, text) => bot!.api.sendMessage(chatId, text),
      print: (input, answer, reportType) => printDurableReport(username, input, answer, reportType),
      project: (input, answer) => {
        const pending = projection.then(() => projectDurableExchange({ username, input, answer }));
        projection = pending.catch(() => undefined);
        return pending;
      },
      onReport: (error) => logger.error('Durable runtime reported an error', { username, error }),
    });
  } catch (error) {
    await storage.close(context);
    throw error;
  }
}

/** Shares one opening attempt and evicts closed/failed handles before recovery. */
function getRuntime(username: string): Promise<DurableRuntime> {
  const existing = runtimes.get(username);
  if (existing) return existing;
  const pending = openUserRuntime(username);
  runtimes.set(username, pending);
  void pending
    .then((runtime) =>
      runtime.closed.then(() => {
        if (runtimes.get(username) === pending) runtimes.delete(username);
      }),
    )
    .catch((error) => {
      if (runtimes.get(username) === pending) runtimes.delete(username);
      logger.error('Durable runtime opening failed; recovery will retry', { username, error });
    });
  return pending;
}

/** Recovers every active linked user's journal without waiting for a Telegram update. */
export async function startDurableHost(instance: Bot<BotContext>): Promise<void> {
  parseLlmSettings();
  bot = instance;
  stopping = false;
  const model = resolveConfiguredModel(appConfig.LLM_MODEL, models);
  if (!(await models.getAuth(model.provider)))
    throw new Error(`LLM credentials are required for provider "${model.provider}"`);
  await recoverUsers();
  timer = setInterval(() => {
    void recoverUsers();
  }, 30_000);
  timer.unref();
}

/** Retries registry/storage outages without creating a second owner for an open journal. */
async function recoverUsers(): Promise<void> {
  try {
    const env = createEnv();
    const users = await createUserRegistry(env.COUCHDB_URL, env).list();
    await Promise.allSettled(
      users
        .filter(
          (user) => user.status === 'active' && user.telegram_id && user.preferences?.mcpApiKey,
        )
        .map((user) => getRuntime(user.username)),
    );
  } catch (error) {
    logger.error('Durable user recovery failed; recovery will retry', { error });
  }
}

/** Closes durable work before disconnecting MCP during shutdown. */
export async function stopDurableHost(): Promise<void> {
  stopping = true;
  clearInterval(timer);
  const opened = await Promise.allSettled(runtimes.values());
  await Promise.all(
    opened.map((result) => (result.status === 'fulfilled' ? result.value.close() : undefined)),
  );
  runtimes.clear();
}

/** Resolves the same active Eddo conversation for interactive and scheduled inputs. */
async function activeConversationId(username: string): Promise<string> {
  const env = createEnv();
  const database = (await import('@eddo/core-server')).createAssistantConversationDatabase(
    env.COUCHDB_URL,
    env,
    username,
  );
  await database.ensureDatabase();
  await database.setupDesignDocuments();
  return (await database.getOrCreateActive())._id;
}

export interface ScheduledReportRequest {
  username: string;
  telegramId: number;
  type: ReportType;
  occurrence: string;
  text: string;
  deadline: number;
}

/** Durably admits a report without blocking the scheduler on queued generation or delivery. */
export async function enqueueDurableReport(request: ScheduledReportRequest): Promise<void> {
  await resolveDurableUser(request.username, request.telegramId);
  const runtime = await getRuntime(request.username);
  const now = new Date();
  await runtime.enqueue({
    requestId: `report:${bot!.botInfo.id}:${request.type}:${request.occurrence}`,
    text: request.text,
    conversationId: await activeConversationId(request.username),
    chatId: request.telegramId,
    telegramId: request.telegramId,
    messageId: 0,
    createdAt: now.toISOString(),
    deadline: request.deadline,
    report: { type: request.type, occurrence: request.occurrence },
  });
}

/** Admits private Telegram updates with a bot-scoped stable deduplication key. */
export async function executeDurableMessage(text: string, ctx: BotContext): Promise<string> {
  const username = ctx.session.user?.username;
  if (!username || !ctx.from || !ctx.chat || !ctx.message || ctx.chat.type !== 'private') {
    throw new Error('Durable requires a linked private Telegram chat');
  }
  await resolveDurableUser(username, ctx.from.id);
  const runtime = await getRuntime(username);
  const conversationId = await activeConversationId(username);
  const input: DurableRequestInput = {
    requestId: `telegram:${bot!.botInfo.id}:${ctx.update.update_id}`,
    text,
    conversationId,
    chatId: ctx.chat.id,
    telegramId: ctx.from.id,
    messageId: ctx.message.message_id,
    createdAt: new Date(ctx.message.date * 1000).toISOString(),
    deadline: Date.now() + 300_000,
  };
  return runtime.execute(input);
}
