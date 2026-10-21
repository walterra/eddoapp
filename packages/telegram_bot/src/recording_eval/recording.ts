import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { EvidenceEvent, Recording } from './schema.js';

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'toolResult']),
  content: z.unknown(),
  toolName: z.string().optional(),
  toolCallId: z.string().optional(),
  isError: z.boolean().optional(),
});
const cassetteSchema = z.object({
  testName: z.string(),
  interactions: z
    .array(
      z.object({
        request: z.object({
          model: z.string(),
          messages: z.array(z.object({ role: z.string(), content: z.string() })),
        }),
        response: z.string(),
      }),
    )
    .min(1),
});
const responseSchema = z.object({
  format: z.literal('pi-durable-assistant-v1'),
  message: messageSchema,
});

/** Removes private reasoning and provider accounting from review input. */
function visibleMessage(value: unknown): string | undefined {
  const message = messageSchema.parse(value);
  if (message.role === 'system') return undefined;
  const content = Array.isArray(message.content)
    ? message.content.filter((block: unknown) => {
        const type = z.object({ type: z.string() }).parse(block).type;
        return ['text', 'toolCall', 'image'].includes(type);
      })
    : message.content;
  return JSON.stringify({ ...message, content });
}

/** Appends only new messages when requests repeat conversation history. */
function appendSnapshot(events: EvidenceEvent[], snapshot: EvidenceEvent[]): void {
  let overlap = Math.min(events.length, snapshot.length);
  while (
    overlap > 0 &&
    !snapshot
      .slice(0, overlap)
      .every((event, index) => event.content === events[events.length - overlap + index].content)
  )
    overlap -= 1;
  for (const event of snapshot.slice(overlap)) {
    events.push({ ...event, id: `event-${events.length + 1}` });
  }
}

/** Reconstructs visible conversation events with source locations. */
export function readRecording(path: string, text: string): Recording {
  const cassette = cassetteSchema.parse(JSON.parse(text));
  const events: EvidenceEvent[] = [];
  for (const [interaction, item] of cassette.interactions.entries()) {
    const snapshot: EvidenceEvent[] = [];
    for (const [index, message] of item.request.messages.entries()) {
      if (message.role === 'system') continue;
      const content = visibleMessage(JSON.parse(message.content));
      if (content)
        snapshot.push({
          id: '',
          interaction,
          source: `request.messages[${index}]`,
          role: message.role,
          content,
        });
    }
    appendSnapshot(events, snapshot);
    const response = responseSchema.parse(JSON.parse(item.response));
    const content = visibleMessage(response.message);
    if (content)
      events.push({
        id: `event-${events.length + 1}`,
        interaction,
        source: 'response.message',
        role: 'assistant',
        content,
      });
  }
  const subjectModel = cassette.interactions[0].request.model;
  if (cassette.interactions.some((item) => item.request.model !== subjectModel))
    throw new Error('Recording contains multiple subject models');
  return {
    path,
    sha256: createHash('sha256').update(text).digest('hex'),
    scenarioId: cassette.testName,
    subjectModel,
    events,
  };
}
