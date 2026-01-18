/**
 * Container operations for chat sessions.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { createUserRegistry, type Env } from '@eddo/core-server';
import type { AiProviderKeys, ChatSession } from '@eddo/core-shared';

import type { ContainerManager, RpcEventCallback, SearxngManager } from '../docker';
import type { RepoManager } from '../git';
import type { getChatDb } from './chat-session-helpers';
import { logStepCompleted, logStepFailed, logStepStarted } from './setup-logging';

/** Chat service context for container operations */
export interface ContainerContext {
  env: Env;
  couchUrl: string;
  repoManager: RepoManager;
  containerManager: ContainerManager;
  searxngManager: SearxngManager;
}

/** Options for spawning container */
export interface SpawnOptions {
  ctx: ContainerContext;
  chatDb: ReturnType<typeof getChatDb>;
  session: ChatSession;
  sessionId: string;
  username: string;
  onEvent?: RpcEventCallback;
}

/** User preferences relevant for container configuration */
interface ContainerUserPrefs {
  aiProviderKeys?: AiProviderKeys;
  githubToken?: string | null;
}

/** Build auth.json content for pi-coding-agent */
interface PiAuthJson {
  anthropic?: { type: 'api_key'; key: string };
  openai?: { type: 'api_key'; key: string };
  google?: { type: 'api_key'; key: string };
}

/** Sanitize session ID for filesystem paths (no colons for Docker volume mounts) */
export function sanitizeSessionIdForPath(sessionId: string): string {
  return sessionId.replace(/:/g, '-');
}

/** Fetch user preferences for container configuration */
export async function getUserPrefsForContainer(
  ctx: ContainerContext,
  username: string,
): Promise<ContainerUserPrefs> {
  try {
    const userRegistry = createUserRegistry(ctx.couchUrl, ctx.env);
    const user = await userRegistry.findByUsername(username);
    return {
      aiProviderKeys: user?.preferences?.aiProviderKeys,
      githubToken: user?.preferences?.githubToken,
    };
  } catch {
    return {};
  }
}

/** Create auth.json file for pi-coding-agent in the session directory */
export async function createAuthJson(sessionDir: string, userKeys?: AiProviderKeys): Promise<void> {
  const auth: PiAuthJson = {};
  if (userKeys?.anthropicApiKey)
    auth.anthropic = { type: 'api_key', key: userKeys.anthropicApiKey };
  if (userKeys?.openaiApiKey) auth.openai = { type: 'api_key', key: userKeys.openaiApiKey };
  if (userKeys?.geminiApiKey) auth.google = { type: 'api_key', key: userKeys.geminiApiKey };

  const piAgentDir = join(sessionDir, '.pi', 'agent');
  await mkdir(piAgentDir, { recursive: true });
  await writeFile(join(piAgentDir, 'auth.json'), JSON.stringify(auth, null, 2));
}

/** Build environment variables for container */
function buildContainerEnv(githubToken?: string | null): Record<string, string> {
  const env: Record<string, string> = {
    EDDO_MCP_URL: 'http://host.docker.internal:3001/mcp',
    SEARXNG_URL: 'http://searxng:8080',
  };
  if (githubToken) env.GH_TOKEN = githubToken;
  return env;
}

/** Prepare directories for container */
async function prepareDirectories(
  session: ChatSession,
  sessionId: string,
): Promise<{ workspacePath: string; sessionDir: string }> {
  const workspacePath = session.worktreePath ?? '/tmp/eddo-workspace';
  const sanitizedSessionId = sanitizeSessionIdForPath(sessionId);
  const sessionDir = `/tmp/eddo-sessions/${sanitizedSessionId}`;
  await mkdir(workspacePath, { recursive: true });
  await mkdir(sessionDir, { recursive: true });
  return { workspacePath, sessionDir };
}

/** Prepare session directories and spawn container */
export async function prepareAndSpawnContainer(
  opts: SpawnOptions,
): Promise<{ success: boolean; error?: string }> {
  const { ctx, chatDb, session, sessionId, username, onEvent } = opts;

  await ctx.searxngManager.ensureRunning();
  await logStepStarted(chatDb, sessionId, 'container', 'Starting Docker container...');
  await chatDb.update(sessionId, { containerState: 'creating' });

  const { workspacePath, sessionDir } = await prepareDirectories(session, sessionId);
  const userPrefs = await getUserPrefsForContainer(ctx, username);
  await createAuthJson(sessionDir, userPrefs.aiProviderKeys);

  const containerEnv = buildContainerEnv(userPrefs.githubToken);
  const mainGitDir = session.repository
    ? ctx.repoManager.getMainGitDir(session.repository.slug)
    : undefined;

  const spawnResult = await ctx.containerManager.spawnContainer({
    sessionId,
    username,
    config: {
      image: 'pi-coding-agent:latest',
      workspacePath,
      sessionDir,
      mainGitDir,
      piConfigDir: join(sessionDir, '.pi', 'agent'),
      env: containerEnv,
    },
    onEvent,
  });

  if (!spawnResult.success) {
    const errorMsg = spawnResult.error ?? 'Unknown error starting container';
    await logStepFailed({
      chatDb,
      sessionId,
      step: 'container',
      message: 'Failed to start container',
      error: errorMsg,
    });
    await chatDb.update(sessionId, { containerState: 'error' });
    return { success: false, error: `Failed to start container: ${errorMsg}` };
  }

  await chatDb.update(sessionId, {
    containerState: 'running',
    containerId: spawnResult.containerId,
  });
  await logStepCompleted(chatDb, sessionId, 'container', 'Container started successfully');
  await logStepCompleted(chatDb, sessionId, 'ready', 'Session is ready');

  return { success: true };
}
