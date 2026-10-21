import type { Recording, Review } from './schema.js';

export interface ReviewResult {
  status: 'completed' | 'error';
  recording: Recording;
  review?: Review;
  error?: string;
}

/** Escapes table cells while keeping source quotations intact in JSON. */
function cell(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;')
    .replace(/\r?\n/g, '<br>');
}

/** Renders findings with exact source evidence rather than model-generated quotations. */
export function renderReport(results: ReviewResult[]): string {
  const lines = [
    '# Recording review',
    '',
    'Reviews recorded behavior only. Does not verify database state or replay compatibility.',
    '',
    '| Model / scenario | User requests | Criterion | Verdict | Explanation | Recorded evidence |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const result of results) {
    const name = `${result.recording.subjectModel} / ${result.recording.scenarioId}`;
    const requests = result.recording.events
      .filter((event) => event.role === 'user')
      .map((event) => `${event.id}: ${event.content}`)
      .join('\n');
    if (!result.review) {
      lines.push(
        `| ${cell(name)} | ${cell(requests)} | — | error | ${cell(result.error ?? 'Review failed')} | — |`,
      );
      continue;
    }
    for (const judgment of result.review.judgments) {
      const evidence = judgment.evidenceIds
        .map((id) => {
          const event = result.recording.events.find((item) => item.id === id)!;
          return `${id} (${event.role}, interaction ${event.interaction}): ${event.content}`;
        })
        .join('\n');
      lines.push(
        `| ${[name, requests, judgment.criterion, judgment.verdict, judgment.explanation, evidence].map(cell).join(' | ')} |`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}
