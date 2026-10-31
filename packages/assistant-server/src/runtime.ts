import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { Models, ModelThinkingLevel } from '@earendil-works/pi-ai';
import {
  createRegistry,
  defineExtension,
  Harness,
  section,
  type ModelRef,
  type Storage,
} from '@earendil-works/pi-durable';
import type { AssistantPendingRequests, AssistantRequestStatus } from '@eddo/core-shared';
import { modelThinkingLevel, parseLlmSettings, type LlmGenerationSettings } from './llm_options.js';
import { configureConversationModels } from './model_configuration.js';
import { modelsWithOptions } from './models_with_options.js';
import { modelsWithTelemetry } from './models_with_telemetry.js';
import { bindRuntimeOwner } from './ownership.js';
import { getPendingRequests, initializePendingRequests } from './pending_requests.js';
import { createProjectionTask } from './projection_task.js';
import type { ContextWriter } from './report_context.js';
import { getRequestStatus } from './request_status.js';
import { createRequestTask, type RequestDependencies } from './request_task.js';
import { waitForRequestResult } from './request_wait.js';
import { createRuntimeAdmission } from './runtime_admission.js';
import type { RuntimeRequestInput } from './state.js';

export interface DurableRuntimeOptions extends RequestDependencies {
  storage: Storage;
  models: Models;
  extensions?: readonly ReturnType<typeof defineExtension>[];
  username: string;
  telegramId?: number;
  model: ModelRef;
  generation?: LlmGenerationSettings;
  instructions: string;
  memoryContext?: () => Promise<string>;
  progress?: (text: string) => Promise<unknown>;
  legacyHistory?: (conversationId: string) => Promise<string>;
  onReport: (error: unknown) => void;
}

export interface ResolvedRuntimeOptions extends DurableRuntimeOptions {
  generation: LlmGenerationSettings;
  thinkingLevel: ModelThinkingLevel;
}

function resolveRuntimeOptions(options: DurableRuntimeOptions): ResolvedRuntimeOptions {
  const generation = options.generation ?? parseLlmSettings();
  const model = options.models.getModel(options.model.provider, options.model.modelId);
  if (!model) throw new Error('Cannot configure generation for an unknown model');
  return { ...options, generation, thinkingLevel: modelThinkingLevel(model, generation) };
}

export interface DurableRuntime {
  enqueue: (input: RuntimeRequestInput) => Promise<void>;
  execute: (input: RuntimeRequestInput) => Promise<string>;
  getPendingRequests: () => Promise<AssistantPendingRequests>;
  getRequestStatus: (requestId: string) => Promise<AssistantRequestStatus | null>;
  close: () => Promise<void>;
  closed: Harness['closed'];
}

/** Builds the native MCP tools and the persisted request task definition. */
function createRuntimeRegistry(options: DurableRuntimeOptions): ReturnType<typeof createRegistry> {
  const registry = createRegistry();
  const requestTask = createRequestTask(options);
  for (const extension of options.extensions ?? []) registry.install(extension);
  registry.install(
    defineExtension({
      name: 'eddo.telegram',
      tasks: [requestTask, createProjectionTask(options)],
      sections: [
        section('eddo', () => options.instructions, { tag: false }),
        ...(options.memoryContext
          ? [section('eddo_memories', () => options.memoryContext?.())]
          : []),
      ],
    }),
  );
  return registry;
}

/** Validates persisted ownership before starting any recovered tasks. */
async function createHarness(options: ResolvedRuntimeOptions): Promise<Harness> {
  // Harness.open() starts paused; registry callbacks run after this handle exists.
  const writeContext: ContextWriter = async (id, submission, context) => {
    const conversation = await harness.conversation(id, context);
    if (!conversation) throw new Error('Report conversation is missing');
    const settled = await (await conversation.submit(submission, context)).wait(context);
    if (settled.status !== 'done') throw new Error('Report context correction could not be placed');
  };
  const harness = await Harness.open(
    options.storage,
    {
      models: modelsWithTelemetry(modelsWithOptions(options.models, options.generation), {
        'user.id': options.telegramId === undefined ? options.username : String(options.telegramId),
      }),
      registry: createRuntimeRegistry({ ...options, writeContext }),
      onReport: options.onReport,
      settings: {
        toolExecution: 'sequential',
        progress: { partialIntervalMs: 1000, outputIntervalMs: 1000 },
      },
    },
    context,
  );
  try {
    await bindRuntimeOwner(harness, options);
    await configureConversationModels(harness, options.model, options.thinkingLevel);
    await initializePendingRequests(harness);
    return harness;
  } catch (error) {
    await harness.close(context);
    throw error;
  }
}

/** Opens one single-owner journal and resumes persisted request/delivery work. */
export async function openDurableRuntime(options: DurableRuntimeOptions): Promise<DurableRuntime> {
  const configured = resolveRuntimeOptions(options);
  const harness = await createHarness(configured);
  const submit = createRuntimeAdmission(harness, configured);
  harness.resume();
  return {
    closed: harness.closed,
    getRequestStatus: (requestId) => getRequestStatus(harness, requestId),
    getPendingRequests: () => getPendingRequests(harness),
    close: () => harness.close(context),
    enqueue: async (input) => {
      await submit(input);
    },
    execute: async (input) => {
      const taskId = await submit(input);
      return waitForRequestResult(harness, taskId, { requestId: input.requestId });
    },
  };
}
