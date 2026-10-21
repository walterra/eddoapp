import type { Api } from 'grammy';
import type { MessageEntity } from 'grammy/types';

/** Restricts fallback to explicit entity rejection, never ambiguous transport failures. */
function rejectedEntities(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('error_code' in error) || error.error_code !== 400)
    return false;
  return (
    'description' in error &&
    typeof error.description === 'string' &&
    /(?:parse entities|entit(?:y|ies))/i.test(error.description)
  );
}

/** Sends Telegram entities and retries plain text only after a definite formatting rejection. */
export async function sendTelegramText(
  api: Pick<Api, 'sendMessage'>,
  chatId: number,
  text: string,
  entities?: MessageEntity[],
): Promise<unknown> {
  if (!entities?.length) return api.sendMessage(chatId, text);
  try {
    return await api.sendMessage(chatId, text, { entities });
  } catch (error) {
    if (!rejectedEntities(error)) throw error;
    return api.sendMessage(chatId, text);
  }
}
