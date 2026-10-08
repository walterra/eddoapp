type ReplicationActivityListener = (active: boolean) => void;

let replicationActive = false;
const listeners = new Set<ReplicationActivityListener>();

/** Returns whether the main database replication is transferring changes. */
export function isReplicationActive(): boolean {
  return replicationActive;
}

/** Updates replication activity and notifies invalidation coordinators. */
export function setReplicationActive(active: boolean): void {
  if (replicationActive === active) return;
  replicationActive = active;
  listeners.forEach((listener) => listener(active));
}

/** Subscribes to main database replication activity changes. */
export function subscribeToReplicationActivity(listener: ReplicationActivityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
