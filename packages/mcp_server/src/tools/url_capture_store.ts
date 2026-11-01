import { randomUUID } from 'node:crypto';

export interface UrlCapture {
  sourceUrl: string;
  title: string;
  markdown: string;
  metadata: Record<string, string>;
}

interface CaptureEntry {
  owner: string;
  expiresAt: number;
  capture: UrlCapture;
}

const entries = new Map<string, CaptureEntry>();
const ttl = 60 * 60 * 1000;

/** Removes expired captures before enforcing the process-wide memory bound. */
function prune(): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= Date.now()) entries.delete(key);
  }
  if (entries.size >= 100) {
    const oldest = entries.keys().next().value;
    if (oldest) entries.delete(oldest);
  }
}

/** Stores bounded extraction data behind an opaque, user-scoped reference. */
export function storeCapture(owner: string, capture: UrlCapture): string {
  prune();
  const reference = randomUUID();
  entries.set(reference, { owner, capture, expiresAt: Date.now() + ttl });
  return reference;
}

/** Resolves references without allowing cross-account access or silently losing page content. */
export function resolveCapture(owner: string, reference: string): UrlCapture {
  const entry = entries.get(reference);
  if (!entry || entry.owner !== owner || entry.expiresAt <= Date.now())
    throw new Error(
      'URL capture unavailable; fetch the URL again or explicitly save without enrichment',
    );
  return entry.capture;
}

/** Reuses recent captures only within the same account. */
export function cachedCapture(owner: string, sourceUrl: string): string | undefined {
  for (const [reference, entry] of entries) {
    if (
      entry.owner === owner &&
      entry.capture.sourceUrl === sourceUrl &&
      entry.expiresAt > Date.now()
    )
      return reference;
  }
  return undefined;
}
