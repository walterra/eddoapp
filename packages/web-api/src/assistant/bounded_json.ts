import { AssistantApiError } from './assistant_errors';

/** Bounds backend responses before parsing; never forwards raw JSON diagnostics. */
export async function boundedJson(
  response: Pick<Response, 'body'>,
  maximumBytes: number,
  overflowStatus: 413 | 503 = 503,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new AssistantApiError(503, 'unavailable');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > maximumBytes) {
      void reader.cancel().catch(() => undefined);
      throw new AssistantApiError(
        overflowStatus,
        overflowStatus === 413 ? 'body_too_large' : 'unavailable',
      );
    }
    chunks.push(chunk.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
