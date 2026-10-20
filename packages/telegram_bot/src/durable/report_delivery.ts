import { BRIEFING_CONTENT_MARKER, RECAP_CONTENT_MARKER } from '../constants/briefing.js';
import { printIfEnabled } from '../scheduler/helpers/printer.js';
import { lookupUserByTelegramId } from '../utils/user-lookup.js';
import type { DurableRequestInput } from './state.js';

export interface PreparedReply {
  answer: string;
  printable: boolean;
}

/** Removes report transport markers while retaining the native answer in the conversation. */
export function prepareReply(input: DurableRequestInput, answer: string): PreparedReply {
  if (!input.report) return { answer, printable: false };
  const marker = input.report.type === 'briefing' ? BRIEFING_CONTENT_MARKER : RECAP_CONTENT_MARKER;
  const position = answer.indexOf(marker);
  if (position < 0) return { answer, printable: false };
  const clean = answer.slice(position + marker.length).trim();
  return { answer: clean || 'The report contained no content.', printable: Boolean(clean) };
}

/** Resolves current preferences before a best-effort, non-replayed printer attempt. */
export async function printDurableReport(
  username: string,
  input: DurableRequestInput,
  answer: string,
): Promise<void> {
  if (!input.report) return;
  const user = await lookupUserByTelegramId(input.telegramId);
  if (user?.username !== username)
    throw new Error('Report printer identity is no longer authorized');
  const enabled =
    input.report.type === 'briefing' ? user.preferences.printBriefing : user.preferences.printRecap;
  if (!enabled) return;
  await printIfEnabled({ userId: user._id, username, content: answer, type: input.report.type });
}
