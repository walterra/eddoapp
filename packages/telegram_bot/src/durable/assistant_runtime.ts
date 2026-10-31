import { assistantRequest } from '@eddo/assistant-server/request_channel';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import type { ReportType } from '@eddo/assistant-server/state';
import type { AssistantRequest } from '@eddo/core-shared';
import { authorizeAssistantRequest, resolveAssistantAccount } from './account_authorization.js';
import type { RequestDependencies } from './request_dependencies.js';
import { openDurableRuntime, type DurableRuntimeOptions } from './runtime.js';

/** Supplies account-based execution with channel-specific side effects injected by the host. */
export interface AssistantRuntimeOptions extends Omit<
  DurableRuntimeOptions,
  'authorize' | 'authorizeTool' | 'project' | 'print' | 'send'
> {
  project: (request: AssistantRequest, answer: string) => Promise<void>;
  print?: (request: AssistantRequest, answer: string, reportType?: ReportType) => Promise<void>;
  send?: RequestDependencies['send'];
}

/** Opens the same Harness and task registry for web, Telegram, and recovered legacy work. */
export async function openAssistantRuntime(
  options: AssistantRuntimeOptions,
): Promise<DurableRuntime> {
  const identity = { username: options.username };
  await resolveAssistantAccount(identity, { telegramId: options.telegramId });
  return openDurableRuntime({
    ...options,
    authorize: (input) =>
      authorizeAssistantRequest(
        identity,
        assistantRequest(options.username, input),
        options.telegramId,
      ),
    authorizeTool: (request, report) =>
      request
        ? authorizeAssistantRequest(identity, request, options.telegramId)
        : resolveAssistantAccount(identity, {
            telegramId: options.telegramId,
            ...(report ? { report: { type: report } } : {}),
          }),
    project: (input, answer) => options.project(assistantRequest(options.username, input), answer),
    print: options.print
      ? (input, answer, type) =>
          options.print!(assistantRequest(options.username, input), answer, type)
      : undefined,
    send:
      options.send ??
      (async () => {
        throw new Error('Telegram delivery adapter is unavailable');
      }),
  });
}
