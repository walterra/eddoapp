// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readAssistantEvents } from './assistant_sse';

function response(chunks: Uint8Array[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

describe('assistant SSE parser', () => {
  it('preserves UTF-8, CRLF frames, event names, and durable IDs across arbitrary chunks', async () => {
    const bytes = new TextEncoder().encode(
      ': heartbeat\r\n\r\nid: checkpoint-12\r\nevent: request-status\r\ndata: {"text":"Grüße 👋"}\r\n\r\n',
    );
    const events = vi.fn();
    await readAssistantEvents(
      response(Array.from(bytes, (byte) => new Uint8Array([byte]))),
      events,
    );
    expect(events).toHaveBeenCalledExactlyOnceWith({
      event: 'request-status',
      id: 'checkpoint-12',
      data: { text: 'Grüße 👋' },
    });
  });

  it('discards unfinished frames so reconnects do not advance past an unprocessed event', async () => {
    const events = vi.fn();
    await readAssistantEvents(
      response([new TextEncoder().encode('event: checkpoint\ndata: {"cursor":"12"}')]),
      events,
    );
    expect(events).not.toHaveBeenCalled();
  });

  it('bounds frames and cancels the reader on protocol failure', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(65_537)));
      },
      cancel,
    });
    await expect(
      readAssistantEvents(
        new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'protocol' });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
