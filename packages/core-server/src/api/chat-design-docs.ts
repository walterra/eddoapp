import type nano from 'nano';

/**
 * Design documents for chat database queries.
 */

/** Design document type */
interface DesignDoc {
  _id: string;
  _rev?: string;
  views: Record<string, { map: string; reduce?: string }>;
}

/** Session design document for querying chat sessions */
const sessionsDesignDoc: DesignDoc = {
  _id: '_design/sessions',
  views: {
    /** All sessions ordered by creation date (newest first) */
    by_created: {
      map: `function(doc) {
        if (doc.version === 'alpha1' && doc.username) {
          emit(doc.createdAt, null);
        }
      }`,
    },
    /** Sessions by container state */
    by_container_state: {
      map: `function(doc) {
        if (doc.version === 'alpha1' && doc.containerState) {
          emit(doc.containerState, null);
        }
      }`,
    },
    /** Sessions by repository slug */
    by_repository: {
      map: `function(doc) {
        if (doc.version === 'alpha1' && doc.repository && doc.repository.slug) {
          emit(doc.repository.slug, null);
        }
      }`,
    },
  },
};

/** Entries design document for querying session entries */
const entriesDesignDoc: DesignDoc = {
  _id: '_design/entries',
  views: {
    /** Entries by session ID (ordered by entry ID for tree traversal) */
    by_session: {
      map: `function(doc) {
        if (doc.sessionId && doc.entry) {
          emit([doc.sessionId, doc.entry.id], null);
        }
      }`,
    },
    /** Entries by session ID and parent ID (for branch queries) */
    by_session_parent: {
      map: `function(doc) {
        if (doc.sessionId && doc.entry) {
          emit([doc.sessionId, doc.entry.parentId || ''], null);
        }
      }`,
    },
    /** Message entries only (for message history) */
    by_session_messages: {
      map: `function(doc) {
        if (doc.sessionId && doc.entry && doc.entry.type === 'message') {
          emit([doc.sessionId, doc.entry.timestamp], null);
        }
      }`,
    },
  },
};

/**
 * Set up design documents for a chat database.
 * Uses the combined database for both sessions and entries.
 * @param couchConnection - The nano server connection
 * @param dbName - Name of the database
 */
export async function setupChatDesignDocuments(
  couchConnection: nano.ServerScope,
  dbName: string,
): Promise<void> {
  const db = couchConnection.db.use<DesignDoc>(dbName);
  await upsertDesignDoc(db, sessionsDesignDoc);
  await upsertDesignDoc(db, entriesDesignDoc);
}

/**
 * Upsert a design document (create or update if changed)
 */
async function upsertDesignDoc(
  db: nano.DocumentScope<DesignDoc>,
  designDoc: DesignDoc,
): Promise<void> {
  const docId = designDoc._id;

  try {
    const existing = await db.get(docId);
    const existingViews = JSON.stringify(existing.views);
    const newViews = JSON.stringify(designDoc.views);

    if (existingViews !== newViews) {
      await db.insert({
        ...designDoc,
        _rev: existing._rev,
      });
    }
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      await db.insert(designDoc);
    } else {
      throw error;
    }
  }
}

/** Check if error is a 404 not found */
function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404,
  );
}
