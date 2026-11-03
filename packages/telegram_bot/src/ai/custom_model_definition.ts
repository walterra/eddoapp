import {
  arr,
  bool,
  int,
  lit,
  nullable,
  num,
  obj,
  oneOf,
  opt,
  str,
} from '@eddo/core-shared/validation/schema_parser';

export const compatibilityDefinition = obj({
  supportsStore: opt(bool()),
  supportsDeveloperRole: opt(bool()),
  supportsReasoningEffort: opt(bool()),
  supportsUsageInStreaming: opt(bool()),
  supportsStrictMode: opt(bool()),
  requiresReasoningContentOnAssistantMessages: opt(bool()),
  maxTokensField: opt(oneOf(['max_tokens', 'max_completion_tokens'])),
  thinkingFormat: opt(oneOf(['openai', 'qwen', 'qwen-chat-template', 'chat-template', 'deepseek'])),
});
const thinkingValue = nullable(str());
const thinkingLevelMap = obj({
  off: opt(thinkingValue),
  minimal: opt(thinkingValue),
  low: opt(thinkingValue),
  medium: opt(thinkingValue),
  high: opt(thinkingValue),
  xhigh: opt(thinkingValue),
  max: opt(thinkingValue),
});
export const costDefinition = obj({
  input: num({ minimum: 0 }),
  output: num({ minimum: 0 }),
  cacheRead: num({ minimum: 0 }),
  cacheWrite: num({ minimum: 0 }),
});
export const customModelDefinition = obj({
  id: str({ minLength: 1 }),
  name: opt(str()),
  reasoning: bool(),
  input: arr(oneOf(['text', 'image'])),
  contextWindow: int({ minimum: 1 }),
  maxTokens: int({ minimum: 1 }),
  cost: costDefinition,
  compat: opt(compatibilityDefinition),
  thinkingLevelMap: opt(thinkingLevelMap),
});

export const publicProviderFields = {
  name: opt(str()),
  api: lit('openai-completions'),
  baseUrl: str(),
  compat: opt(compatibilityDefinition),
  models: arr(customModelDefinition, { minItems: 1 }),
};
