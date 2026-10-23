import { describe, expect, it, vi } from 'vitest';
import {
  executeMutationOnce,
  type MutationReceipt,
  type MutationReceiptStore,
} from './mutation_receipts.js';

const operationId = 'a'.repeat(64);
function store(): MutationReceiptStore {
  const records = new Map<string, MutationReceipt>();
  return {
    get: async (id) => structuredClone(records.get(id)),
    create: async (record) => {
      if (records.has(record._id)) throw new Error('Receipt already claimed');
      const claimed = { ...record, _rev: '1' };
      records.set(record._id, structuredClone(claimed));
      return claimed;
    },
    complete: async (record) => {
      if (records.get(record._id)?._rev !== record._rev) throw new Error('Receipt conflict');
      records.set(record._id, structuredClone({ ...record, _rev: '2' }));
    },
  };
}

const request = { operationId, tool: 'createTodo', args: { title: 'Task' } };

describe('receiver-side mutation receipts', () => {
  it('returns the original completed result without repeating execution', async () => {
    const receipts = store();
    const execute = vi.fn().mockResolvedValue('Created');
    expect(await executeMutationOnce(receipts, request, execute)).toBe('Created');
    expect(await executeMutationOnce(receipts, request, execute)).toBe('Created');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('allows at most one racing invocation', async () => {
    const receipts = store();
    const execute = vi.fn().mockResolvedValue('Created');
    const results = await Promise.allSettled([
      executeMutationOnce(receipts, request, execute),
      executeMutationOnce(receipts, request, execute),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(execute).toHaveBeenCalledOnce();
  });

  it('rejects different arguments or tool names under an existing operation ID', async () => {
    const receipts = store();
    const execute = vi.fn().mockResolvedValue('Created');
    await executeMutationOnce(receipts, request, execute);
    await expect(
      executeMutationOnce(receipts, { ...request, args: { title: 'Other' } }, execute),
    ).rejects.toThrow('different arguments');
    await expect(
      executeMutationOnce(receipts, { ...request, tool: 'deleteTodo' }, execute),
    ).rejects.toThrow('different arguments');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('does not replay an interrupted or failed invocation', async () => {
    const receipts = store();
    const execute = vi.fn().mockRejectedValue(new Error('Transport failed after a possible write'));
    await expect(executeMutationOnce(receipts, request, execute)).rejects.toThrow('possible write');
    await expect(executeMutationOnce(receipts, request, execute)).rejects.toThrow(
      'outcome is unknown',
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it('does not repeat an effect after response-receipt persistence fails', async () => {
    const receipts = store();
    receipts.complete = vi.fn().mockRejectedValue(new Error('Acknowledgment lost'));
    const execute = vi.fn().mockResolvedValue('Created');
    await expect(executeMutationOnce(receipts, request, execute)).rejects.toThrow(
      'Acknowledgment lost',
    );
    await expect(executeMutationOnce(receipts, request, execute)).rejects.toThrow(
      'outcome is unknown',
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it('recovers a completed receipt whose acknowledgment was lost without reexecuting', async () => {
    const receipts = store();
    const complete = receipts.complete;
    receipts.complete = async (record) => {
      await complete(record);
      throw new Error('Acknowledgment lost');
    };
    const execute = vi.fn().mockResolvedValue('Created');
    await expect(executeMutationOnce(receipts, request, execute)).rejects.toThrow(
      'Acknowledgment lost',
    );
    expect(await executeMutationOnce(receipts, request, execute)).toBe('Created');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('does not execute after an ambiguously published claim', async () => {
    const receipts = store();
    const create = receipts.create;
    receipts.create = async (record) => {
      await create(record);
      throw new Error('Claim acknowledgment lost');
    };
    const execute = vi.fn();
    await expect(executeMutationOnce(receipts, request, execute)).rejects.toThrow(
      'acknowledgment lost',
    );
    await expect(executeMutationOnce(receipts, request, execute)).rejects.toThrow(
      'outcome is unknown',
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs before executing', async () => {
    const execute = vi.fn();
    await expect(
      executeMutationOnce(store(), { ...request, operationId: '../bad' }, execute),
    ).rejects.toThrow('Invalid');
    expect(execute).not.toHaveBeenCalled();
  });

  it('normalizes object key order without normalizing mutation arguments', async () => {
    const receipts = store();
    const execute = vi.fn().mockResolvedValue({ ok: true });
    await executeMutationOnce(
      receipts,
      { ...request, args: { title: 'Task', due: '2026-10-20' } },
      execute,
    );
    expect(
      await executeMutationOnce(
        receipts,
        { ...request, args: { due: '2026-10-20', title: 'Task' } },
        execute,
      ),
    ).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledOnce();
  });
});
