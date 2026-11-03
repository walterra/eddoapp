import { createFieldNormalizer } from '@eddo/core-shared/validation/field_normalization';
import { createObjectProjection } from '@eddo/core-shared/validation/object_projection';
import { costDefinition } from './custom_model_definition.js';

const normalizeFields = createFieldNormalizer({
  fields: ['reasoning', 'input', 'contextWindow', 'maxTokens', 'cost'],
  preserveUnknown: true,
  defaults: {
    reasoning: false,
    input: ['text'],
    contextWindow: 32768,
    maxTokens: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
});
const projectCost = createObjectProjection(costDefinition);

/** Supplies model defaults while preserving unknown fields for strict rejection. */
export function normalizeCustomModel(value: unknown): unknown {
  const normalized = normalizeFields(value);
  if (typeof normalized !== 'object' || normalized === null || Array.isArray(normalized))
    return normalized;
  return { ...normalized, cost: projectCost(Reflect.get(normalized, 'cost')) };
}

/** Normalizes nested models without projecting provider or compatibility fields. */
export function normalizeCustomProvider(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const models: unknown = Object.hasOwn(value, 'models') ? Reflect.get(value, 'models') : undefined;
  return Array.isArray(models) ? { ...value, models: models.map(normalizeCustomModel) } : value;
}
