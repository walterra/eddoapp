import { validateAbsoluteUrl } from '@eddo/core-shared/validation/compatibility';
import {
  coerceNumber,
  createFieldNormalizer,
} from '@eddo/core-shared/validation/field_normalization';
import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import { arr, int, obj, opt, str, union } from '@eddo/core-shared/validation/schema_parser';

import { validatePublicUrl } from './public_url.js';
import type { UrlCapture } from './url_capture_store.js';

const readerData = createProjectedParser(
  obj({
    title: opt(str()),
    url: opt(str()),
    content: str({ minLength: 1 }),
    description: opt(str()),
    publishedTime: opt(str()),
    author: opt(union([str(), arr(str())])),
  }),
);
const readerResponse = createProjectedParser(obj({ data: readerData.schema }));
const configSchema = createProjectedParser(
  obj({ base: str(), key: opt(str()), maxBytes: int({ minimum: 1024, maximum: 1_000_000 }) }),
  {
    normalize: createFieldNormalizer({
      fields: ['base', 'key', 'maxBytes'],
      defaults: { base: 'https://r.jina.ai', maxBytes: 200_000 },
      conversions: { maxBytes: coerceNumber },
    }),
    validate: (value) => validateAbsoluteUrl(value.base, '/base'),
  },
);

interface ReaderConfig {
  base: string;
  key?: string;
  maxBytes: number;
}

/** Validates server-controlled Reader configuration without accepting tool-supplied credentials. */
function readerConfig(): ReaderConfig {
  const config = configSchema.parse({
    base: process.env.JINA_READER_URL || undefined,
    key: process.env.JINA_API_KEY,
    maxBytes: process.env.JINA_MAX_CONTENT_BYTES || undefined,
  });
  if (!['http:', 'https:'].includes(new URL(config.base).protocol))
    throw new Error('Reader endpoint must use HTTP(S)');
  return config;
}

/** Reads bounded JSON without buffering an unlimited upstream response. */
async function boundedBody(response: Response): Promise<string> {
  if (!response.body) throw new Error('Empty Reader response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4_000_000) throw new Error('Reader response exceeds transport limit');
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await reader.cancel();
  }
}

/** Maps supported Reader metadata without retaining arbitrary upstream fields. */
function captureData(
  data: ReturnType<typeof readerData.parse>,
  sourceUrl: string,
  maxBytes: number,
): UrlCapture {
  const bytes = Buffer.from(data.content);
  const truncated = bytes.length > maxBytes;
  const markdown = truncated
    ? new TextDecoder().decode(bytes.subarray(0, maxBytes), { stream: true }) +
      '\n\n[Page content truncated by Eddo]'
    : data.content;
  const metadata: Record<string, string> = {
    'web:sourceUrl': sourceUrl,
    'web:fetchedAt': new Date().toISOString(),
    'web:provider': 'jina-reader',
    'web:truncated': String(truncated),
  };
  const optional = {
    title: data.title,
    resolvedUrl: data.url,
    description: data.description,
    publishedAt: data.publishedTime,
    author: Array.isArray(data.author) ? data.author.join(', ') : data.author,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value) metadata['web:' + key] = value.slice(0, 2000);
  }
  return {
    sourceUrl,
    title: data.title?.slice(0, 500) || new URL(sourceUrl).hostname,
    markdown,
    metadata,
  };
}

/** Fetches Markdown through Reader; never forwards cookies or source authentication. */
export async function readUrl(raw: string): Promise<UrlCapture> {
  const url = await validatePublicUrl(raw);
  const config = readerConfig();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Respond-With': 'markdown',
    'X-Retain-Images': 'alt',
    'X-Timeout': '25',
  };
  if (config.key) headers.Authorization = 'Bearer ' + config.key;
  const response = await fetch(config.base.replace(/\/+$/, '') + '/' + url.href, {
    headers,
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Reader request failed');
  const data = readerResponse.parse(JSON.parse(await boundedBody(response))).data;
  if (data.url) await validatePublicUrl(data.url);
  return captureData(data, raw, config.maxBytes);
}
