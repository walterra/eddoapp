import type nano from 'nano';
import type { MutationReceipt, MutationReceiptStore } from '../tools/mutation_receipts.js';

/** Validates caller-supplied command identity before provisioning or tool execution. */
export function parseMcpOperationId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new Error('Invalid MCP operation ID');
  return value;
}

/** Recognizes CouchDB status errors without suppressing other transport failures. */
function hasStatus(error: unknown, status: number): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === status,
  );
}

/** Adapts revision-checked receipt writes without retries after ambiguous responses. */
function receiptStore(database: nano.DocumentScope<MutationReceipt>): MutationReceiptStore {
  return {
    get: async (id) => {
      try {
        return await database.get(id);
      } catch (error) {
        if (hasStatus(error, 404)) return undefined;
        throw error;
      }
    },
    create: async (receipt) => {
      const result = await database.insert(receipt);
      return { ...receipt, _rev: result.rev };
    },
    complete: async (receipt) => {
      await database.insert(receipt);
    },
  };
}

/** Provisions private durable receipts separately from replicated application todo documents. */
async function openReceiptStore(
  couch: nano.ServerScope,
  userDatabase: string,
): Promise<MutationReceiptStore> {
  const name = `${userDatabase}_mcp_operations`;
  try {
    await couch.db.create(name);
  } catch (error) {
    if (!hasStatus(error, 412)) throw error;
  }
  await couch.request({
    db: name,
    path: '_security',
    method: 'PUT',
    body: {
      admins: { roles: ['_admin'] },
      members: { roles: ['_admin'] },
    },
  });
  return receiptStore(couch.db.use<MutationReceipt>(name));
}

/** Shares provisioning attempts while allowing a later retry after a failed opening. */
export function createMutationStoreFactory(
  couch: nano.ServerScope,
): (userDatabase: string) => Promise<MutationReceiptStore> {
  const stores = new Map<string, Promise<MutationReceiptStore>>();
  return (database) => {
    const existing = stores.get(database);
    if (existing) return existing;
    const pending = openReceiptStore(couch, database);
    stores.set(database, pending);
    void pending.catch(() => {
      if (stores.get(database) === pending) stores.delete(database);
    });
    return pending;
  };
}
