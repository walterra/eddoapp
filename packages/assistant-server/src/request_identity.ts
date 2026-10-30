import type { AssistantRequest } from '@eddo/core-shared';
import { createHash } from 'node:crypto';

/** Binds retries to message content and delivery source, excluding server-assigned admission timing. */
export function requestPayloadHash(request: AssistantRequest): string {
  const telegram = request.source.channel === 'telegram' ? request.source.telegram : undefined;
  return createHash('sha256')
    .update(
      JSON.stringify([
        request.account.username,
        request.text,
        request.source.channel,
        telegram?.chatId,
        telegram?.userId,
        telegram?.messageId,
        request.report?.type,
        request.report?.occurrence,
      ]),
    )
    .digest('hex');
}
