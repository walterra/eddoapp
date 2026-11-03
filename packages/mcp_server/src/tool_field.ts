import type { Schema } from '@eddo/core-shared/validation/schema_parser';

interface ToolFieldAnnotations<T> {
  readonly description?: string;
  readonly default?: T;
}

/** Places wrapper annotations before validation keywords to preserve published tool bytes. */
export function toolField<T>(
  schema: Schema<T>,
  annotations: ToolFieldAnnotations<NoInfer<T>>,
): Schema<T> {
  const annotated = { ...annotations, ...schema };
  return { ...annotated, ...annotations };
}
