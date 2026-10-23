import type { Context } from '@earendil-works/chord';
import { defineDoc, type ToolExecutionApi } from '@earendil-works/pi-durable';
import { createHash, randomUUID } from 'node:crypto';
import type { MCPUserContext } from '../mcp/user-context.js';

type MutationIdentity = {
  id: string;
};
const MutationNamespace = defineDoc({
  kind: 'eddo.mutation-namespace',
  version: 1,
  scope: 'session',
  initial: (): MutationIdentity => ({ id: randomUUID() }),
});

/** Derives command identity from a persisted journal namespace and tool task, never model arguments. */
export async function mutationContext(
  user: MCPUserContext,
  api: ToolExecutionApi,
  context: Context,
): Promise<MCPUserContext> {
  const namespace = await api.commit(async (tx) => (await tx.doc(MutationNamespace)).id, context);
  const operationId = createHash('sha256')
    .update(`eddo-durable-mutation-v1:${user.username}:${namespace}:${api.taskId}`)
    .digest('hex');
  return { ...user, operationId };
}
