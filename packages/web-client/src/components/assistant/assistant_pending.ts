import { pendingSchema } from './assistant_schemas';
import {
  AssistantClientError,
  type AssistantPendingRequest,
  type AssistantPendingStore,
} from './assistant_types';

function validatedPending(username: string, value: unknown): AssistantPendingRequest {
  const pending = pendingSchema.parse(value);
  if (
    pending.username !== username ||
    (pending.receipt && pending.receipt.requestId !== `web:${username}:${pending.submissionId}`)
  )
    throw new AssistantClientError('storage');
  return pending;
}

/** Retains one unresolved UUID per account without persisting JWTs or assistant response bodies. */
export function createAssistantPendingStore(
  username: string,
  storage: Storage,
): AssistantPendingStore {
  const key = `eddo.assistant.pending.v1.${encodeURIComponent(username)}`;
  const read = (): AssistantPendingRequest | null => {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      if (raw.length > 65_536) throw new Error('Invalid pending state');
      return validatedPending(username, JSON.parse(raw));
    } catch {
      throw new AssistantClientError('storage');
    }
  };
  return {
    read,
    write: (pending) => {
      try {
        const previous = read();
        if (previous && previous.submissionId !== pending.submissionId)
          throw new Error('Another pending request exists');
        storage.setItem(key, JSON.stringify(validatedPending(username, pending)));
      } catch {
        throw new AssistantClientError('storage');
      }
    },
    clear: (id) => {
      try {
        if (read()?.submissionId === id) storage.removeItem(key);
      } catch {
        throw new AssistantClientError('storage');
      }
    },
  };
}
