import type { Api } from 'grammy';
import type { MessageEntity } from 'grammy/types';

export interface TelegramSendOptions {
  entities?: MessageEntity[];
  disableLinkPreview?: boolean;
}

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
  options: TelegramSendOptions = {},
): Promise<unknown> {
  const preview = options.disableLinkPreview
    ? { link_preview_options: { is_disabled: true } }
    : undefined;
  const sendPlain = (): Promise<unknown> =>
    preview ? api.sendMessage(chatId, text, preview) : api.sendMessage(chatId, text);
  if (!options.entities?.length) return sendPlain();
  try {
    return await api.sendMessage(chatId, text, { ...preview, entities: options.entities });
  } catch (error) {
    if (!rejectedEntities(error)) throw error;
    return sendPlain();
  }
}
