import type nano from 'nano';

interface DesignDoc {
  _id: string;
  _rev?: string;
  views: Record<string, { map: string }>;
}

const assistantConversationDesignDoc: DesignDoc = {
  _id: '_design/assistant_conversations',
  views: {
    by_updated: {
      map: `function(doc) {
        if (doc.version === 'assistant_conversation_alpha1') {
          emit(doc.updatedAt, null);
        }
      }`,
    },
    messages_by_conversation: {
      map: `function(doc) {
        if (doc.version === 'assistant_conversation_message_alpha1' && doc.conversationId) {
          emit([doc.conversationId, doc.sequence || 0, doc.createdAt, doc._id], null);
        }
      }`,
    },
  },
};

/** Sets up design documents for assistant conversations. */
export async function setupAssistantConversationDesignDocuments(
  couchConnection: nano.ServerScope,
  dbName: string,
): Promise<void> {
  const db = couchConnection.db.use<DesignDoc>(dbName);
  await upsertDesignDoc(db, assistantConversationDesignDoc);
}

async function upsertDesignDoc(
  db: nano.DocumentScope<DesignDoc>,
  designDoc: DesignDoc,
): Promise<void> {
  try {
    const existing = await db.get(designDoc._id);
    if (JSON.stringify(existing.views) === JSON.stringify(designDoc.views)) return;
    await db.insert({ ...designDoc, _rev: existing._rev });
  } catch (error: unknown) {
    if (!isNotFoundError(error)) throw error;
    await db.insert(designDoc);
  }
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404,
  );
}
