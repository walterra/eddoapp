import type { Models } from '@earendil-works/pi-ai';
import { boundedLlmOptions, type LlmGenerationSettings } from './llm_options.js';

/** Applies output limits at Durable's streamSimple boundary, including automatic compaction. */
export function modelsWithOptions(models: Models, settings: LlmGenerationSettings): Models {
  const streamSimple: Models['streamSimple'] = (model, context, options) =>
    models.streamSimple(model, context, boundedLlmOptions(model, settings, options));
  const completeSimple: Models['completeSimple'] = (model, context, options) =>
    streamSimple(model, context, options).result();
  // Bind unmodified methods to their original owner: Models implementations can use private fields.
  return new Proxy(models, {
    get(target, property): unknown {
      if (property === 'streamSimple') return streamSimple;
      if (property === 'completeSimple') return completeSimple;
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
