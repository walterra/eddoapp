import { AssistantClientError, type AssistantServerEvent } from './assistant_types';

function frame(value: string): AssistantServerEvent | null {
  let event = 'message';
  let id: string | undefined;
  const data: string[] = [];
  for (const line of value.split('\n')) {
    const split = line.indexOf(':');
    const field = split === -1 ? line : line.slice(0, split);
    const content = line.slice(split + 1).replace(/^ /, '');
    if (field === 'event') event = content;
    if (field === 'id' && !content.includes('\0')) id = content;
    if (field === 'data') data.push(content);
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) as unknown, ...(id ? { id } : {}) };
  } catch {
    throw new AssistantClientError('protocol');
  }
}

function consumeFrames(buffer: string, onEvent: (event: AssistantServerEvent) => void): string {
  let boundary = buffer.indexOf('\n\n');
  while (boundary !== -1) {
    if (boundary > 65_536) throw new AssistantClientError('protocol');
    const parsed = frame(buffer.slice(0, boundary));
    if (parsed) onEvent(parsed);
    buffer = buffer.slice(boundary + 2);
    boundary = buffer.indexOf('\n\n');
  }
  return buffer;
}

/** Parses bounded SSE frames across arbitrary UTF-8, CRLF, and network chunk boundaries. */
export async function readAssistantEvents(
  response: Response,
  onEvent: (event: AssistantServerEvent) => void,
): Promise<void> {
  if (!response.body || !response.headers.get('Content-Type')?.startsWith('text/event-stream'))
    throw new AssistantClientError('protocol');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replace(/\r\n/g, '\n');
      buffer = consumeFrames(buffer, onEvent);
      if (buffer.length > 65_536) throw new AssistantClientError('protocol');
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
