type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
interface JsonObject {
  [key: string]: JsonValue;
}
interface TextBlock {
  type: 'text';
  text: string;
}
interface ArrayCandidate {
  path: string;
  value: JsonValue[];
}
interface StringCandidate {
  parent: JsonObject | JsonValue[];
  key: string;
  value: string;
}
interface Candidates {
  arrays: ArrayCandidate[];
  strings: StringCandidate[];
}
export interface ToolOutput {
  text: string;
  isError: boolean;
}

function isTextBlock(value: unknown): value is TextBlock {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'text' &&
    'text' in value &&
    typeof value.text === 'string',
  );
}

function parseText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Removes MCP transport wrappers before applying a model-facing output budget. */
function unwrap(result: unknown): unknown {
  if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content))
    return unwrap(result.content);
  if (Array.isArray(result) && result.every(isTextBlock)) {
    return result.length === 1
      ? parseText(result[0].text)
      : result.map((block) => parseText(block.text));
  }
  if (typeof result === 'string') return parseText(result);
  return result;
}

function collect(value: JsonValue, path: string, candidates: Candidates, depth = 0): void {
  if (!value || typeof value !== 'object' || depth > 12) return;
  if (Array.isArray(value) && value.length > 1) candidates.arrays.push({ path, value });
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && child.length > 200)
      candidates.strings.push({ parent: value, key, value: child });
    else collect(child, `${path}.${key}`, candidates, depth + 1);
  }
}

/** Reduces complete JSON values; metadata and at least one item per section survive normal budgets. */
function reduce(value: JsonValue, omitted: Record<string, number>): boolean {
  const candidates: Candidates = { arrays: [], strings: [] };
  collect(value, '$', candidates);
  const largest = candidates.arrays.sort(
    (a, b) => JSON.stringify(b.value).length - JSON.stringify(a.value).length,
  )[0];
  if (largest) {
    largest.value.pop();
    omitted[largest.path] = (omitted[largest.path] ?? 0) + 1;
    return true;
  }
  const longest = candidates.strings.sort((a, b) => b.value.length - a.value.length)[0];
  if (!longest) return false;
  const text = `${longest.value.slice(0, Math.max(160, Math.floor(longest.value.length / 2)))}…`;
  setText(longest.parent, longest.key, text);
  return true;
}

function hasError(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return (
    ('isError' in value && value.isError === true) || ('error' in value && Boolean(value.error))
  );
}

/** Returns bounded, valid JSON with explicit transport truncation instead of cutting serialized bytes. */
export function normalizeToolOutput(result: unknown, maxChars = 12_000): ToolOutput {
  if (!Number.isInteger(maxChars) || maxChars < 256)
    throw new Error('Tool output budget must be at least 256 characters');
  const normalized = unwrap(result);
  const serialized = JSON.stringify(normalized) ?? 'null';
  const isError = hasError(result) || hasError(normalized);
  if (serialized.length <= maxChars)
    return { text: typeof normalized === 'string' ? normalized : serialized, isError };
  return boundOutput(serialized, maxChars, isError);
}

function setText(parent: JsonObject | JsonValue[], key: string, text: string): void {
  if (Array.isArray(parent)) parent[Number(key)] = text;
  else parent[key] = text;
}

function isContainer(value: JsonValue): value is JsonObject | JsonValue[] {
  return value !== null && typeof value === 'object';
}

function prebound(value: JsonValue, omitted: Record<string, number>, path = '$', depth = 0): void {
  if (!isContainer(value) || depth > 12) return;
  if (Array.isArray(value) && value.length > 50) {
    omitted[path] = value.length - 50;
    value.splice(50);
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && child.length > 1000) {
      setText(value, key, `${child.slice(0, 1000)}…`);
    } else prebound(child, omitted, `${path}.${key}`, depth + 1);
  }
}

function boundOutput(serialized: string, maxChars: number, isError: boolean): ToolOutput {
  const value = JSON.parse(serialized) as JsonValue;
  const omitted: Record<string, number> = {};
  prebound(value, omitted);
  let shortened = value;
  if (typeof shortened === 'string') shortened = shortened.slice(0, Math.max(0, maxChars - 400));
  let output = JSON.stringify({
    result: shortened,
    outputTruncation: { truncated: true, originalChars: serialized.length, omittedItems: omitted },
  });
  for (let attempt = 0; output.length > maxChars && attempt < 2000; attempt += 1) {
    if (!reduce(shortened, omitted)) break;
    output = JSON.stringify({
      result: shortened,
      outputTruncation: {
        truncated: true,
        originalChars: serialized.length,
        omittedItems: omitted,
      },
    });
  }
  if (output.length > maxChars)
    return {
      text: JSON.stringify({
        error: 'Tool output cannot fit the response budget; request narrower results.',
        outputTruncation: { truncated: true, originalChars: serialized.length },
      }),
      isError: true,
    };
  return { text: output, isError };
}
