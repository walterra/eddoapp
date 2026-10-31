import type {
  InternalAdmission,
  InternalStatusQuery,
} from '@eddo/assistant-server/internal_protocol';
import { parseLlmSettings } from '@eddo/assistant-server/llm_options';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import type { DurableRequestInput, ReportType } from '@eddo/assistant-server/state';
import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { AssistantPendingRequests, AssistantRequestStatus } from '@eddo/core-shared';
import type { Bot } from 'grammy';
import type { BotContext } from '../bot/bot.js';
import { logger } from '../utils/logger.js';
import { createWebHostOperations } from './host_requests.js';
import { openUserRuntime, validateHostModel } from './host_runtime.js';
import { resolveDurableUser } from './tools.js';

const runtimes = new Map<string, Promise<DurableRuntime>>();
let bot: Bot<BotContext> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let stopping = true;
let started = false;
let starting = false;

/** Shares one opening attempt and evicts closed/failed handles before recovery. */
function getRuntime(username: string): Promise<DurableRuntime> {
  if (!started || stopping) return Promise.reject(new Error('Durable host is not running'));
  const existing = runtimes.get(username);
  if (existing) return existing;
  const pending = openUserRuntime(username, bot);
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

/** Recovers eligible accounts independently of Telegram polling or linking. */
export async function startDurableHost(instance?: Bot<BotContext>): Promise<void> {
  if (started || starting) throw new Error('Durable host is already running');
  starting = true;
  stopping = false;
  try {
    parseLlmSettings();
    await validateHostModel();
    if (stopping) throw new Error('Durable host startup was interrupted');
    bot = instance;
    started = true;
    await recoverUsers();
    if (stopping) throw new Error('Durable host startup was interrupted');
    timer = setInterval(() => {
      void recoverUsers();
    }, 30_000);
    timer.unref();
  } finally {
    starting = false;
  }
}

/** Retries registry/storage outages without creating a second owner for an open journal. */
async function recoverUsers(): Promise<void> {
  try {
    const env = createEnv();
    const users = await createUserRegistry(env.COUCHDB_URL, env).list();
    await Promise.allSettled(
      users
        .filter((user) => user.status === 'active' && user.preferences?.mcpApiKey)
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
  started = false;
  bot = undefined;
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

export async function getWebAssistantPendingRequests(
  username: string,
): Promise<AssistantPendingRequests> {
  return webOperations.pending({ username });
}

const webOperations = createWebHostOperations({
  runtime: getRuntime,
  conversationId: activeConversationId,
});

/** Admits authenticated internal web requests through the same owner as Telegram. */
export function admitWebAssistantMessage(
  input: InternalAdmission,
): Promise<AssistantRequestStatus> {
  return webOperations.admit(input);
}

/** Reads durable status without creating a second journal reader or execution owner. */
export function getWebAssistantRequestStatus(
  input: InternalStatusQuery,
): Promise<AssistantRequestStatus | null> {
  return webOperations.status(input);
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
  if (!bot) throw new Error('Telegram report adapter is unavailable');
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
  if (!bot) throw new Error('Telegram message adapter is unavailable');
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
