import type { Context } from '@earendil-works/chord';
import {
  defineExtension,
  defineTool,
  type EntryRecord,
  type ToolExecutionApi,
  type ToolRegistration,
} from '@earendil-works/pi-durable';
import type { TSchema } from 'pi-ai-durable';
import type { MCPClient, MCPTool } from '../mcp/client.js';
import type { MCPUserContext } from '../mcp/user-context.js';
import { lookupUserByTelegramId } from '../utils/user-lookup.js';
import { RunBudget } from './state.js';

const REPLAY_SAFE_TOOLS = new Set([
  'listTodos',
  'getTodo',
  'searchTodos',
  'getActiveTimeTracking',
  'getAttachment',
  'listAttachments',
  'getUserInfo',
  'getServerInfo',
  'getBriefingData',
  'getRecapData',
]);

/** Revalidates identity and credentials for every resumed action. */
export async function resolveDurableUser(
  username: string,
  telegramId: number,
): Promise<MCPUserContext> {
  const user = await lookupUserByTelegramId(telegramId);
  if (user?.username !== username || !user.preferences.mcpApiKey) {
    throw new Error('Durable user is inactive, unlinked, or missing MCP credentials');
  }
  return { username, telegramId, mcpApiKey: user.preferences.mcpApiKey };
}

interface ToolBridgeOptions {
  username: string;
  telegramId: number;
  client: MCPClient;
}

/** Checks the persisted input deadline before an external action can start. */
function deadlineExpired(entry: EntryRecord | undefined): boolean {
  const data = entry?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return typeof data.deadline === 'number' && Date.now() >= data.deadline;
}

/** Counts calls durably, including replay attempts, against the placed input. */
async function consumeToolBudget(api: ToolExecutionApi, context: Context): Promise<boolean> {
  return api.commit(async (tx) => {
    const entries = await tx.scanEntries({ conversationId: api.conversationId }, 1000);
    const entry = entries.items.find((item) => item.kind === 'eddo.input');
    if (deadlineExpired(entry)) return false;
    const input = entry?.id ?? 0;
    const budget = await tx.doc(RunBudget, api.conversationId);
    if (budget.input !== input) {
      budget.input = input;
      budget.tools = 0;
    }
    budget.tools += 1;
    return budget.tools <= 50;
  }, context);
}

/** Bridges a discovered MCP schema without enabling filesystem or shell tools. */
function bridgeTool(tool: MCPTool, options: ToolBridgeOptions): ToolRegistration {
  return defineTool({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema as TSchema,
    replay: REPLAY_SAFE_TOOLS.has(tool.name) ? 'safe' : undefined,
    execute: async (args, api, context) => {
      const allowed = await consumeToolBudget(api, context);
      if (!allowed)
        return {
          output: [
            {
              type: 'text',
              text: 'Tool execution limit reached. Inspect current state before continuing.',
            },
          ],
          isError: true,
          control: { terminate: true },
        };
      const user = await resolveDurableUser(options.username, options.telegramId);
      const result = await options.client.invoke(tool.name, args as Record<string, unknown>, user);
      const text = JSON.stringify(result) ?? '';
      return { output: [{ type: 'text', text: text.slice(0, 12_000) }] };
    },
  });
}

/** Registers tools with explicit per-tool replay policies. */
export function createMcpExtension(options: ToolBridgeOptions): ReturnType<typeof defineExtension> {
  return defineExtension({
    name: 'eddo.mcp',
    tools: options.client.tools.map((tool) => bridgeTool(tool, options)),
  });
}
