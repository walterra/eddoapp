export type FieldConversion = (value: unknown) => unknown;

export interface FieldNormalization {
  readonly fields: readonly string[];
  readonly defaults?: Readonly<Record<string, unknown>>;
  readonly conversions?: Readonly<Record<string, FieldConversion>>;
}

/** Projects fields, supplies missing defaults, and applies explicitly selected conversions. */
export function createFieldNormalizer(options: FieldNormalization): FieldConversion {
  return (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
    const entries = options.fields.flatMap((key) => {
      const present = Object.hasOwn(value, key);
      const original: unknown = present ? Reflect.get(value, key) : undefined;
      const fallback =
        options.defaults && Object.hasOwn(options.defaults, key)
          ? options.defaults[key]
          : undefined;
      const selected: unknown = original === undefined ? structuredClone(fallback) : original;
      const convert =
        options.conversions && Object.hasOwn(options.conversions, key)
          ? options.conversions[key]
          : undefined;
      if (!present && selected === undefined) return [];
      return [[key, convert ? convert(selected) : selected]];
    });
    return Object.fromEntries(entries);
  };
}

/** Matches explicit JavaScript numeric coercion without exposing conversion exceptions. */
export function coerceNumber(value: unknown): number {
  try {
    return Number(value);
  } catch {
    return Number.NaN;
  }
}

/** Trims strings without accepting other primitive types. */
export function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
