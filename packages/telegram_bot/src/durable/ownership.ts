import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { defineDoc, type Harness } from '@earendil-works/pi-durable';

const RuntimeOwner = defineDoc({
  kind: 'eddo.owner',
  version: 1,
  scope: 'session',
  initial: (): { username: string; telegramId: number } => ({ username: '', telegramId: 0 }),
});

export interface RuntimeIdentity {
  username: string;
  telegramId: number;
}

/** Prevents relinked accounts from resuming work or delivery for a previous Telegram identity. */
export async function bindRuntimeOwner(harness: Harness, identity: RuntimeIdentity): Promise<void> {
  const owner = await harness.snapshot(RuntimeOwner, context);
  if (owner) {
    if (owner.username !== identity.username || owner.telegramId !== identity.telegramId) {
      throw new Error(
        'Durable journal belongs to another Telegram identity; operator migration required',
      );
    }
    return;
  }
  await harness.commit(async (tx) => {
    const document = await tx.doc(RuntimeOwner);
    document.username = identity.username;
    document.telegramId = identity.telegramId;
  }, context);
}
