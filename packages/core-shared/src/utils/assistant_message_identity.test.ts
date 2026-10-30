// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assistantProjectionIds } from './assistant_message_identity';

describe('browser-compatible assistant projection identity', () => {
  it('matches the server SHA-256 projection convention for each role', async () => {
    const requestId = 'web:alice:70f72756-993e-4cae-8108-f6b723391ae1';
    const hash = createHash('sha256').update(requestId).digest('hex');
    expect(await assistantProjectionIds(requestId)).toEqual({
      user: `assistant_message_durable_${hash}_user`,
      assistant: `assistant_message_durable_${hash}_assistant`,
    });
    expect(await assistantProjectionIds(`${requestId}:other`)).not.toEqual(
      await assistantProjectionIds(requestId),
    );
  });
});
