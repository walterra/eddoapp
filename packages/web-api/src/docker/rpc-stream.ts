/**
 * RPC stream handling for Docker containers.
 */

import { EventEmitter } from 'events';
import type { Readable, Writable } from 'stream';

import type { RpcCommand, RpcEvent, RpcEventCallback, RpcResponse } from './types';

/** Container stream state */
export interface ContainerStream {
  readable: Readable;
  writable: Writable;
  emitter: EventEmitter;
  buffer: string;
}

/** Set up RPC stream for a container */
export function setupRpcStream(
  stream: NodeJS.ReadWriteStream,
  onEvent?: RpcEventCallback,
): ContainerStream {
  const emitter = new EventEmitter();
  const containerStream: ContainerStream = {
    readable: stream as unknown as Readable,
    writable: stream as unknown as Writable,
    emitter,
    buffer: '',
  };

  // Handle incoming data
  stream.on('data', (chunk: Buffer) => {
    const data = chunk.toString();
    console.log('[RPC] Received data:', data.substring(0, 200));
    containerStream.buffer += data;
    processBuffer(containerStream, onEvent);
  });

  stream.on('end', () => {
    emitter.emit('close');
  });

  stream.on('error', (err) => {
    emitter.emit('error', err);
  });

  return containerStream;
}

/** Process the buffer for complete JSON lines */
function processBuffer(containerStream: ContainerStream, onEvent?: RpcEventCallback): void {
  const lines = containerStream.buffer.split('\n');
  containerStream.buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as RpcEvent;
      containerStream.emitter.emit('event', event);
      onEvent?.(event);
    } catch {
      // Not valid JSON, skip
    }
  }
}

/** Send an RPC command and wait for response */
export function sendRpcCommand(
  containerStream: ContainerStream,
  command: RpcCommand,
  timeoutMs = 30000,
): Promise<RpcResponse> {
  return new Promise((resolve) => {
    const commandId = command.id ?? `cmd-${Date.now()}`;
    const fullCommand = { ...command, id: commandId };

    // Set up response listener
    const onEvent = (event: RpcEvent) => {
      const response = event as unknown as RpcResponse;
      if (event.type === 'response' && response.id === commandId) {
        containerStream.emitter.off('event', onEvent);
        resolve(response);
      }
    };

    containerStream.emitter.on('event', onEvent);

    // Send command
    const commandStr = JSON.stringify(fullCommand) + '\n';
    console.log('[RPC] Sending command:', commandStr);
    containerStream.writable.write(commandStr);

    // Timeout
    setTimeout(() => {
      containerStream.emitter.off('event', onEvent);
      resolve({ type: 'response', command: command.type, success: false, error: 'Timeout' });
    }, timeoutMs);
  });
}

/** Register callback for RPC events */
export function onRpcEvent(
  containerStream: ContainerStream,
  callback: RpcEventCallback,
): () => void {
  containerStream.emitter.on('event', callback);
  return () => containerStream.emitter.off('event', callback);
}
