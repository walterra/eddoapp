import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { createRegistry, defineDoc, Harness } from '@earendil-works/pi-durable';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindRuntimeOwner } from './ownership.js';
import { createRuntimeFixture } from './test_helpers.js';

const harnesses: Harness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.close(context)));
});

async function open(storage: Parameters<typeof Harness.open>[0]): Promise<Harness> {
  const fixture = await createRuntimeFixture();
  await fixture.options.storage.close(context);
  const harness = await Harness.open(
    storage,
    {
      models: fixture.options.models,
      registry: createRegistry(),
      onReport: vi.fn(),
    },
    context,
  );
  harnesses.push(harness);
  return harness;
}

const LegacyOwner = defineDoc({
  kind: 'eddo.owner',
  version: 1,
  scope: 'session',
  initial: () => ({ username: '', telegramId: 0 }),
});

describe('account-based journal ownership compatibility', () => {
  it('persists a web-only owner across reopening without Telegram identifiers', async () => {
    const fixture = await createRuntimeFixture();
    const first = await open(fixture.options.storage);
    await bindRuntimeOwner(first, { username: 'alice' });
    expect(await first.snapshot(LegacyOwner, context)).toEqual({ username: 'alice' });
    await first.close(context);
    const second = await open((await fixture.reopen()).storage);
    await expect(bindRuntimeOwner(second, { username: 'alice' })).resolves.toBeUndefined();
    await expect(bindRuntimeOwner(second, { username: 'bob' })).rejects.toThrow('migration');
    await expect(bindRuntimeOwner(second, { username: 'alice', telegramId: 123 })).rejects.toThrow(
      'migration',
    );
  });

  it('preserves legacy owner records and rejects removed or changed Telegram pins', async () => {
    const fixture = await createRuntimeFixture();
    const first = await open(fixture.options.storage);
    await first.commit(async (tx) => {
      const owner = await tx.doc(LegacyOwner);
      owner.username = 'alice';
      owner.telegramId = 123;
    }, context);
    await first.close(context);
    const second = await open((await fixture.reopen()).storage);
    await expect(
      bindRuntimeOwner(second, { username: 'alice', telegramId: 123 }),
    ).resolves.toBeUndefined();
    await expect(bindRuntimeOwner(second, { username: 'alice' })).rejects.toThrow('migration');
    await expect(bindRuntimeOwner(second, { username: 'alice', telegramId: 456 })).rejects.toThrow(
      'migration',
    );
    await expect(bindRuntimeOwner(second, { username: 'bob', telegramId: 123 })).rejects.toThrow(
      'migration',
    );
    expect(await second.snapshot(LegacyOwner, context)).toEqual({
      username: 'alice',
      telegramId: 123,
    });
  });
});
