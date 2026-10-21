import type { Context } from '@earendil-works/chord';
import type { Message } from '@earendil-works/pi-ai';
import type { ConversationId, EntryRecord, SubmissionDraft } from '@earendil-works/pi-durable';
import type { PreparedReply } from './report_delivery.js';
import type { GenerationResult, RequestRuntime } from './request_generation.js';
import type { DurableRequestInput } from './state.js';

type ContextSubmission = Extract<SubmissionDraft, { type: 'write' }>;
export type ContextWriter = (
  conversationId: ConversationId,
  submission: ContextSubmission,
  context: Context,
) => Promise<void>;

interface ReportContextOptions {
  input: DurableRequestInput;
  generated: GenerationResult;
  reply: PreparedReply;
  writeContext?: ContextWriter;
}

/** Replaces final text while retaining thinking, tool blocks, and provider accounting in the original message. */
function correctedMessages(entry: EntryRecord, answer: string): Message[] {
  return (entry.model ?? []).map((message) =>
    message.role !== 'assistant'
      ? message
      : {
          ...message,
          content: [
            ...message.content.filter((block) => block.type !== 'text'),
            { type: 'text', text: answer },
          ],
        },
  );
}

/** Journals a deduplicated context override before delivery, retaining the original provider entry for audit. */
export async function correctReportContext(
  options: ReportContextOptions,
  runtime: RequestRuntime,
  context: Context,
): Promise<void> {
  const { input, generated, reply } = options;
  if (generated.failure || !generated.answerEntry || generated.answer === reply.answer) return;
  if (!input.report && !reply.reportType) return;
  const entry = await runtime.entry(generated.answerEntry, context);
  if (!entry) throw new Error('Report answer entry is missing');
  if (!options.writeContext) throw new Error('Report context writer is unavailable');
  await options.writeContext(
    runtime.conversationId,
    {
      type: 'write',
      requestId: `${input.requestId}:report-context`,
      entry: {
        kind: 'eddo.report-context',
        data: { requestId: input.requestId },
        edits: [
          {
            target: generated.answerEntry,
            action: 'replace',
            messages: correctedMessages(entry, reply.answer),
          },
        ],
      },
    },
    context,
  );
}
