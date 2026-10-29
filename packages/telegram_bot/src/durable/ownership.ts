import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { defineDoc, type Harness } from '@earendil-works/pi-durable';
import type { AssistantAccountIdentity } from '@eddo/core-shared';

type RuntimeOwnerRecord = {
  username: string;
  telegramId?: number;
};

const RuntimeOwner = defineDoc({
  kind: 'eddo.owner',
  version: 1,
  scope: 'session',
  initial: (): RuntimeOwnerRecord => ({ username: '' }),
});

export interface RuntimeIdentity extends AssistantAccountIdentity {
  telegramId?: number;
}

/** Pins the account and any existing Telegram identity without silently transferring ownership. */
export async function bindRuntimeOwner(harness: Harness, identity: RuntimeIdentity): Promise<void> {
  const owner = await harness.snapshot(RuntimeOwner, context);
  if (owner) {
    if (owner.username !== identity.username || owner.telegramId !== identity.telegramId) {
      throw new Error(
        'Durable journal belongs to another Telegram identity or account; operator migration required',
      );
    }
    return;
  }
  await harness.commit(async (tx) => {
    const document = await tx.doc(RuntimeOwner);
    document.username = identity.username;
    if (identity.telegramId !== undefined) document.telegramId = identity.telegramId;
  }, context);
}
