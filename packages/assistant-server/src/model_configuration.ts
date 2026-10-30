import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { ModelThinkingLevel } from '@earendil-works/pi-ai';
import type { ConversationId, Cursor, Harness, ModelRef } from '@earendil-works/pi-durable';

/** Applies model and reasoning settings to existing conversations before pending work resumes. */
export async function configureConversationModels(
  harness: Harness,
  model: ModelRef,
  thinkingLevel: ModelThinkingLevel,
): Promise<void> {
  const ids = await harness.commit(async (tx) => {
    const result: ConversationId[] = [];
    let cursor: Cursor | undefined;
    do {
      const page = await tx.scanConversations({}, 100, cursor);
      result.push(...page.items.map((conversation) => conversation.id));
      cursor = page.next;
    } while (cursor);
    return result;
  }, context);
  for (const id of ids) {
    const conversation = await harness.conversation(id, context);
    if (!conversation)
      throw new Error('Durable conversation disappeared during model configuration');
    await conversation.configure({ model, thinkingLevel }, context);
  }
}
