import type { MessageEntity } from 'grammy/types';

/** Retains the shape of rendered Telegram checkpoints written before runtime extraction. */
export interface TelegramText {
  text: string;
  entities: MessageEntity[];
}
