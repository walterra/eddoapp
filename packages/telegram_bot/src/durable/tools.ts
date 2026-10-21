import type { Context } from '@earendil-works/chord';
import type { TSchema } from '@earendil-works/pi-ai';
import {
  defineExtension,
  defineTool,
  type EntryRecord,
  type ToolExecutionApi,
  type ToolRegistration,
} from '@earendil-works/pi-durable';
import type { MCPClient, MCPTool } from '../mcp/client.js';
import type { MCPUserContext } from '../mcp/user-context.js';
import { lookupUserByTelegramId } from '../utils/user-lookup.js';
import { mutationContext } from './mcp_operation.js';
import { notifyProgress, type ProgressOptions } from './progress.js';
import { RunBudget, type DurableRequestInput, type ReportType } from './state.js';
import { invokeMcpTool } from './tool_execution.js';

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
  report?: ReportType,
): Promise<MCPUserContext> {
  const user = await lookupUserByTelegramId(telegramId);
  if (user?.username !== username || !user.preferences.mcpApiKey) {
    throw new Error('Durable user is inactive, unlinked, or missing MCP credentials');
  }
  if (
    report &&
    !(report === 'briefing' ? user.preferences.dailyBriefing : user.preferences.dailyRecap)
  ) {
    throw new Error('Scheduled report is disabled for this user');
  }
  return { username, telegramId, mcpApiKey: user.preferences.mcpApiKey };
}

interface ToolBridgeOptions extends ProgressOptions {
  username: string;
  telegramId: number;
  client: MCPClient;
}

/** Revalidates report preferences when request phases resume. */
export function authorizeDurableRequest(
  username: string,
  telegramId: number,
  input: DurableRequestInput,
): Promise<MCPUserContext> {
  return resolveDurableUser(username, telegramId, input.report?.type);
}

/** Checks the persisted input deadline before an external action can start. */
function deadlineExpired(entry: EntryRecord | undefined): boolean {
  const data = entry?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  let deadline = typeof data.deadline === 'number' ? data.deadline : Infinity;
  const placed = entry?.model?.find((message) => message.role === 'user');
  if (reportType(entry) && placed) deadline = Math.min(deadline, placed.timestamp + 300_000);
  return Date.now() >= deadline;
}

/** Counts calls durably, including replay attempts, against the placed input. */
interface ToolPermission {
  allowed: boolean;
  callNumber: number;
  report?: ReportType;
}

function reportType(entry: EntryRecord | undefined): ReportType | undefined {
  const data = entry?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  return data.report === 'briefing' || data.report === 'recap' ? data.report : undefined;
}

export async function consumeToolBudget(
  api: ToolExecutionApi,
  context: Context,
): Promise<ToolPermission> {
  return api.commit(async (tx) => {
    const entries = await tx.scanEntries({ conversationId: api.conversationId }, 1000);
    const entry = entries.items.find((item) => item.kind === 'eddo.input');
    if (deadlineExpired(entry)) return { allowed: false, callNumber: 0 };
    const input = entry?.id ?? 0;
    const budget = await tx.doc(RunBudget, api.conversationId);
    if (budget.input !== input) {
      budget.input = input;
      budget.tools = 0;
    }
    budget.tools += 1;
    return { allowed: budget.tools <= 50, report: reportType(entry), callNumber: budget.tools };
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
      const permission = await consumeToolBudget(api, context);
      if (!permission.allowed || (permission.report && !REPLAY_SAFE_TOOLS.has(tool.name)))
        return {
          output: [
            {
              type: 'text',
              text: 'Tool execution denied: budget expired or scheduled reports cannot mutate tasks.',
            },
          ],
          isError: true,
          control: { terminate: true },
        };
      const user = await resolveDurableUser(
        options.username,
        options.telegramId,
        permission.report,
      );
      if (!permission.report) await notifyProgress(options, permission.callNumber);
      const formatted = await invokeMcpTool(
        options.client,
        tool.name,
        args as Record<string, unknown>,
        REPLAY_SAFE_TOOLS.has(tool.name) ? user : await mutationContext(user, api, context),
      );
      return { output: [{ type: 'text', text: formatted.text }], isError: formatted.isError };
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
