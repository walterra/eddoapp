import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { Conversation } from '@earendil-works/pi-durable';

/** Imports once through a deduplicated passive write, including already-created native conversations. */
export async function ensureLegacyHistory(
  conversation: Conversation,
  externalId: string,
  load: (conversationId: string) => Promise<string>,
): Promise<void> {
  const requestId = `eddo:legacy-history:${externalId}`;
  const previous = await conversation.commit(
    (tx) => tx.submissionByRequest(conversation.id, requestId),
    context,
  );
  if (previous) return;
  const content = await load(externalId);
  await conversation.submit(
    {
      type: 'write',
      requestId,
      entry: {
        kind: 'eddo.legacy-history',
        data: { externalId, hasHistory: Boolean(content) },
        ...(content ? { model: [{ role: 'user' as const, content, timestamp: Date.now() }] } : {}),
      },
    },
    context,
  );
}
