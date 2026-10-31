export interface AssistantProjectionIds {
  user: string;
  assistant: string;
}

/** Matches stable server projection IDs without importing server code into the browser. */
export async function assistantProjectionIds(
  requestId: string,
  crypto: Crypto = globalThis.crypto,
): Promise<AssistantProjectionIds> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(requestId));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const prefix = `assistant_message_durable_${hash}`;
  return { user: `${prefix}_user`, assistant: `${prefix}_assistant` };
}
