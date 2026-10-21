import { BACKGROUND_CONTEXT as context, withAbortSignal } from '@earendil-works/chord/context';
import type { Models, ModelThinkingLevel } from '@earendil-works/pi-ai';
import {
  createRegistry,
  defineExtension,
  Harness,
  section,
  type Conversation,
  type ModelRef,
  type Storage,
  type TaskId,
} from '@earendil-works/pi-durable';
import {
  modelThinkingLevel,
  parseLlmSettings,
  type LlmGenerationSettings,
} from '../ai/llm-options.js';
import { modelsWithOptions } from '../ai/models_with_options.js';
import type { MCPClient } from '../mcp/client.js';
import { configureConversationModels } from './model_configuration.js';
import { bindRuntimeOwner } from './ownership.js';
import { createRequestTask, type RequestDependencies } from './request_task.js';
import { ConversationMap, RequestMap, type DurableRequestInput } from './state.js';
import { createMcpExtension } from './tools.js';

export interface DurableRuntimeOptions extends RequestDependencies {
  storage: Storage;
  models: Models;
  client: MCPClient;
  username: string;
  telegramId: number;
  model: ModelRef;
  generation?: LlmGenerationSettings;
  instructions: string;
  memoryContext?: () => Promise<string>;
  onReport: (error: unknown) => void;
}

interface ResolvedRuntimeOptions extends DurableRuntimeOptions {
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
  enqueue: (input: DurableRequestInput) => Promise<void>;
  execute: (input: DurableRequestInput) => Promise<string>;
  close: () => Promise<void>;
  closed: Harness['closed'];
}

/** Finds or creates a native conversation for an existing Eddo chat identity. */
async function getConversation(
  harness: Harness,
  options: ResolvedRuntimeOptions,
  externalId: string,
): Promise<Conversation> {
  const mapping = await harness.snapshot(ConversationMap, context);
  const existing = mapping?.conversations[externalId];
  if (existing !== undefined) {
    const conversation = await harness.conversation(existing, context);
    if (!conversation) throw new Error('Durable conversation mapping is invalid');
    return conversation;
  }
  // Admission is serialized by the runtime, so concurrent first messages cannot fork the mapping.
  return harness.createConversation(
    {
      ownership: { kind: 'ownerless' },
      agent: { model: options.model, thinkingLevel: options.thinkingLevel },
      init: async (tx, conversation) => {
        (await tx.doc(ConversationMap)).conversations[externalId] = conversation;
      },
    },
    context,
  );
}

/** Builds the native MCP tools and the persisted request task definition. */
function createRuntimeRegistry(options: DurableRuntimeOptions): ReturnType<typeof createRegistry> {
  const registry = createRegistry();
  const requestTask = createRequestTask(options);
  registry.install(createMcpExtension(options));
  registry.install(
    defineExtension({
      name: 'eddo.telegram',
      tasks: [requestTask],
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
  const harness = await Harness.open(
    options.storage,
    {
      models: modelsWithOptions(options.models, options.generation),
      registry: createRuntimeRegistry(options),
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
  let admission = Promise.resolve();
  const admit = async (input: DurableRequestInput): Promise<TaskId<string>> => {
    if (input.telegramId !== options.telegramId || input.chatId !== options.telegramId) {
      throw new Error('Durable request does not match the journal owner');
    }
    const previous = await harness.snapshot(RequestMap, context);
    if (previous?.tasks[input.requestId] !== undefined) return previous.tasks[input.requestId];
    const conversation = await getConversation(harness, configured, input.conversationId);
    return conversation.commit(async (tx) => {
      const taskId = await tx.createTask(createRequestTask(options), input, {
        ownership: { kind: 'conversation' },
        background: true,
      });
      (await tx.doc(RequestMap)).tasks[input.requestId] = taskId;
      return taskId;
    }, context);
  };
  const submit = (input: DurableRequestInput): Promise<TaskId<string>> => {
    const pending = admission.then(() => admit(input));
    admission = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  };
  harness.resume();
  return {
    closed: harness.closed,
    close: () => harness.close(context),
    enqueue: async (input) => {
      await submit(input);
    },
    execute: async (input) => {
      const pending = submit(input);
      const wait = withAbortSignal(AbortSignal.timeout(360_000), context);
      const task = await harness.waitForTask(await pending, wait);
      if (task.state.outcome.status !== 'completed')
        throw new Error(`Durable request ${task.state.outcome.status}`);
      return task.state.outcome.result;
    },
  };
}
