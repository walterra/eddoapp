import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { UserSession } from './types.js';

const ReceiptSchema = z.object({
  _id: z.string(),
  _rev: z.string().optional(),
  version: z.literal('mcp_operation_alpha1'),
  requestHash: z.string(),
  status: z.enum(['pending', 'completed']),
  responseJson: z.string().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type MutationReceipt = z.infer<typeof ReceiptSchema>;

export interface MutationReceiptStore {
  get: (id: string) => Promise<MutationReceipt | undefined>;
  create: (receipt: MutationReceipt) => Promise<MutationReceipt>;
  complete: (receipt: MutationReceipt) => Promise<void>;
}

interface MutationRequest {
  operationId: string;
  tool: string;
  args: unknown;
}

const stores = new WeakMap<UserSession, MutationReceiptStore>();

/** Associates a private receiver-side receipt store with the authenticated request session. */
export function attachMutationStore(session: UserSession, store: MutationReceiptStore): void {
  stores.set(session, store);
}

/** Hashes normalized argument keys without persisting arguments or credentials. */
function requestHash(tool: string, args: unknown): string {
  const serialized = JSON.stringify({ tool, args }, (_key, value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => (left < right ? -1 : left === right ? 0 : 1)),
    );
  });
  return createHash('sha256').update(serialized).digest('hex');
}

/** Replays only completed matching commands; pending receipts never authorize a second invocation. */
function recordedResult<T>(receipt: MutationReceipt, hash: string): T {
  const parsed = ReceiptSchema.parse(receipt);
  if (parsed.requestHash !== hash)
    throw new Error('MCP operation ID was reused with different arguments');
  if (parsed.status !== 'completed' || parsed.responseJson === undefined)
    throw new Error(
      'MCP operation is pending or its outcome is unknown; inspect state before retrying',
    );
  const result: unknown = JSON.parse(parsed.responseJson);
  return result as T;
}

/** Claims an operation before execution and persists its response without retrying ambiguous writes. */
export async function executeMutationOnce<T>(
  store: MutationReceiptStore,
  request: MutationRequest,
  execute: () => Promise<T>,
): Promise<T> {
  if (!/^[a-f0-9]{64}$/.test(request.operationId)) throw new Error('Invalid MCP operation ID');
  const id = `mcp_operation_${request.operationId}`;
  const hash = requestHash(request.tool, request.args);
  const existing = await store.get(id);
  if (existing) return recordedResult<T>(existing, hash);
  const claim = await store.create({
    _id: id,
    version: 'mcp_operation_alpha1',
    requestHash: hash,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  const result = await execute();
  const responseJson = JSON.stringify(result);
  if (responseJson === undefined || Buffer.byteLength(responseJson) > 1_000_000)
    throw new Error('MCP operation result cannot fit its receipt; outcome remains unknown');
  await store.complete({
    ...claim,
    status: 'completed',
    responseJson,
    completedAt: new Date().toISOString(),
  });
  return result;
}

/** Requires receiver protection for requests carrying an operation ID; ordinary clients remain compatible. */
export async function executeWithMutationReceipt<T>(
  tool: string,
  args: unknown,
  session: UserSession | undefined,
  execute: () => Promise<T>,
): Promise<T> {
  if (!session?.operationId) return execute();
  const store = stores.get(session);
  if (!store) throw new Error('MCP operation receipt store is unavailable');
  return executeMutationOnce(store, { operationId: session.operationId, tool, args }, execute);
}
