import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import {
  arr,
  bool,
  lit,
  obj,
  oneOf,
  opt,
  str,
  unknown as unknownSchema,
} from '@eddo/core-shared/validation/schema_parser';
import { createHash } from 'node:crypto';
import type { EvidenceEvent, Recording } from './schema.js';

const messageDefinition = obj({
  role: oneOf(['system', 'user', 'assistant', 'toolResult']),
  content: unknownSchema(),
  toolName: opt(str()),
  toolCallId: opt(str()),
  isError: opt(bool()),
});
const messageSchema = createProjectedParser(messageDefinition);
const blockSchema = createProjectedParser(obj({ type: str() }));
const cassetteSchema = createProjectedParser(
  obj({
    testName: str(),
    interactions: arr(
      obj({
        request: obj({
          model: str(),
          messages: arr(obj({ role: str(), content: str() })),
        }),
        response: str(),
      }),
      { minItems: 1 },
    ),
  }),
);
const responseSchema = createProjectedParser(
  obj({
    format: lit('pi-durable-assistant-v1'),
    message: messageDefinition,
  }),
);

/** Removes private reasoning and provider accounting from review input. */
function visibleMessage(value: unknown): string | undefined {
  const message = messageSchema.parse(value);
  if (message.role === 'system') return undefined;
  const content = Array.isArray(message.content)
    ? message.content.filter((block: unknown) => {
        const type = blockSchema.parse(block).type;
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
