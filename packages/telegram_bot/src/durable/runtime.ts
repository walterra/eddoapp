import {
  openDurableRuntime as openSharedRuntime,
  type DurableRuntimeOptions as SharedRuntimeOptions,
} from '@eddo/assistant-server/runtime';
import type { MCPClient } from '../mcp/client.js';
import { createLegacyArchiveExtension, type LegacyArchiveOptions } from './legacy_archive_tool.js';
import { prepareReply } from './report_delivery.js';
import { deliverAnswer } from './request_delivery.js';
import type { RequestDependencies } from './request_dependencies.js';
import { createMcpExtension } from './tools.js';

/** Composes host-owned MCP discovery and Telegram delivery with shared durable execution. */
export interface DurableRuntimeOptions
  extends
    Omit<SharedRuntimeOptions, 'deliver' | 'prepareReply'>,
    RequestDependencies,
    LegacyArchiveOptions {
  client: MCPClient;
}

/** Keeps the Telegram runtime entry point while delegating journal execution to the shared package. */
export function openDurableRuntime(
  options: DurableRuntimeOptions,
): ReturnType<typeof openSharedRuntime> {
  return openSharedRuntime({
    ...options,
    prepareReply,
    deliver: (task, runtime, context) => deliverAnswer(task, runtime, context, options),
    extensions: [
      ...(options.extensions ?? []),
      createMcpExtension(options),
      createLegacyArchiveExtension(options),
    ],
  });
}
