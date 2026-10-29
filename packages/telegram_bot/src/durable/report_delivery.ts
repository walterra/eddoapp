import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { UserRegistryEntry } from '@eddo/core-shared';
import { BRIEFING_CONTENT_MARKER, RECAP_CONTENT_MARKER } from '../constants/briefing.js';
import { printIfEnabled } from '../scheduler/helpers/printer.js';
import { lookupUserByTelegramId } from '../utils/user-lookup.js';
import { renderReportHeading } from './report_heading.js';
import { assistantRequest } from './request_channel.js';
import type { ReportType, RuntimeRequestInput } from './state.js';

export interface PreparedReply {
  answer: string;
  printable: boolean;
  reportType?: ReportType;
}

/** Removes report transport markers while retaining the native answer in the conversation. */
export function prepareReply(input: RuntimeRequestInput, answer: string): PreparedReply {
  const reportType = input.report?.type ?? detectReportType(answer);
  if (!reportType) return { answer, printable: false };
  const marker = reportType === 'briefing' ? BRIEFING_CONTENT_MARKER : RECAP_CONTENT_MARKER;
  const position = answer.indexOf(marker);
  if (position < 0)
    return {
      answer: /^DAILY (?:BRIEFING|RECAP)\b/i.test(answer)
        ? renderReportHeading(input, answer)
        : answer,
      printable: false,
    };
  const clean = answer.slice(position + marker.length).trim();
  return {
    answer: clean
      ? input.report
        ? renderReportHeading(input, clean)
        : clean
      : 'The report contained no content.',
    printable: Boolean(clean),
    ...(!input.report ? { reportType } : {}),
  };
}

/** Identifies generated reports without treating ordinary messages as scheduled requests. */
function detectReportType(answer: string): ReportType | undefined {
  if (answer.includes(BRIEFING_CONTENT_MARKER)) return 'briefing';
  if (answer.includes(RECAP_CONTENT_MARKER)) return 'recap';
  return undefined;
}

/** Resolves web report printing preferences without requiring Telegram linking. */
async function lookupPrintingAccount(username: string): Promise<UserRegistryEntry | null> {
  const env = createEnv();
  const user = await createUserRegistry(env.COUCHDB_URL, env).findByUsername(username);
  return user?.status === 'active' ? user : null;
}

/** Resolves current preferences before a best-effort, non-replayed printer attempt. */
export async function printDurableReport(
  username: string,
  input: RuntimeRequestInput,
  answer: string,
  manualReportType?: ReportType,
): Promise<void> {
  const type = input.report?.type ?? manualReportType;
  if (!type) return;
  const request = assistantRequest(username, input);
  const user =
    request.source.channel === 'telegram'
      ? await lookupUserByTelegramId(request.source.telegram.userId)
      : await lookupPrintingAccount(username);
  if (user?.username !== username)
    throw new Error('Report printer identity is no longer authorized');
  const enabled =
    type === 'briefing' ? user.preferences.printBriefing : user.preferences.printRecap;
  if (!enabled) return;
  await printIfEnabled({ userId: user._id, username, content: answer, type });
}
