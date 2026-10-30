import { createInternalAssistantHandler } from '@eddo/assistant-server/internal_handler';
import type { InternalAssistantOperations } from '@eddo/assistant-server/internal_protocol';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

export interface InternalServerOptions extends InternalAssistantOperations {
  token: string;
  port: number;
}

export interface InternalAssistantServer {
  port: number;
  close: () => Promise<void>;
}

interface StreamingRequestInit extends RequestInit {
  duplex: 'half';
}

function fetchRequest(incoming: IncomingMessage): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(',') : value);
  }
  const method = incoming.method ?? 'GET';
  const init: StreamingRequestInit = { method, headers, duplex: 'half' };
  if (method !== 'GET' && method !== 'HEAD')
    init.body = Readable.toWeb(incoming) as unknown as ReadableStream<Uint8Array>;
  return new Request(new URL(incoming.url ?? '/', 'http://127.0.0.1'), init);
}

async function respond(response: Response, outgoing: ServerResponse): Promise<void> {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

/** Contains malformed-request and response-stream failures within their connection. */
async function handleIncoming(
  handler: (request: Request) => Promise<Response>,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): Promise<void> {
  try {
    await respond(await handler(fetchRequest(incoming)), outgoing);
  } catch {
    await respond(
      Response.json(
        { error: 'unavailable' },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        },
      ),
      outgoing,
    );
  }
}

/** Binds internal transport to loopback; admission uses the existing owner rather than another Harness. */
export async function startInternalAssistantServer(
  options: InternalServerOptions,
): Promise<InternalAssistantServer> {
  const handler = createInternalAssistantHandler(options);
  const server = createServer((incoming, outgoing) => {
    void handleIncoming(handler, incoming, outgoing).catch(() => outgoing.destroy());
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 32;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Internal assistant listener is unavailable');
  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
  };
}
