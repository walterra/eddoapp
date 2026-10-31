import type { RequestDependencies as SharedRequestDependencies } from '@eddo/assistant-server/request_task';
import type { TelegramSendOptions } from './telegram_send.js';

/** Supplies Telegram side effects while the shared package owns durable request phases. */
export interface RequestDependencies extends Omit<
  SharedRequestDependencies,
  'deliver' | 'prepareReply'
> {
  send: (chatId: number, text: string, options?: TelegramSendOptions) => Promise<unknown>;
}
