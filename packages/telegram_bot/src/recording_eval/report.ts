import type { Recording, Review } from './schema.js';

export interface ReviewResult {
  status: 'completed' | 'error';
  recording: Recording;
  review?: Review;
  error?: string;
}

/** Escapes table cells and keeps each finding on one line. */
function cell(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;')
    .replace(/\r?\n/g, ' ');
}

function concerns(result: ReviewResult): Review['judgments'] {
  return (
    result.review?.judgments.filter((item) => !['pass', 'not_applicable'].includes(item.verdict)) ??
    []
  );
}

function verdict(result: ReviewResult | undefined): string {
  if (!result) return '—';
  if (result.status === 'error' || !result.review) return 'Error';
  const findings = concerns(result);
  if (findings.some((item) => item.verdict === 'fail')) return 'Fail';
  if (findings.some((item) => item.verdict === 'partial')) return 'Concern';
  if (findings.length) return 'Unclear';
  return result.review.judgments.every((item) => item.verdict === 'not_applicable')
    ? 'N/A'
    : 'Pass';
}

/** Limits older verbose explanations without changing the stored evaluation. */
function brief(text: string): string {
  const line = cell(text);
  return line.length > 240 ? `${line.slice(0, 237)}...` : line;
}

function findingLines(result: ReviewResult): string[] {
  const name = `${result.recording.subjectModel} / ${result.recording.scenarioId}`;
  if (result.status === 'error' || !result.review)
    return [`- **${cell(name)}:** Error — ${brief(result.error ?? 'Review failed')}`];
  return concerns(result).map(
    (item) =>
      `- **${cell(name)} · ${item.criterion}:** ${brief(item.explanation)} (${item.verdict}; ${item.evidenceIds.join(', ') || 'no evidence'})`,
  );
}

/** Shows one row per scenario and details only for concerns; full evidence stays in JSON. */
export function renderReport(results: ReviewResult[]): string {
  const models = [...new Set(results.map((item) => item.recording.subjectModel))];
  const scenarios = [...new Set(results.map((item) => item.recording.scenarioId))];
  const lines = [
    '# Recording review',
    '',
    'Recorded behavior only. Full findings and evidence: [review.json](review.json).',
    '',
    `| Scenario | ${models.map(cell).join(' | ')} |`,
    `| --- | ${models.map(() => '---').join(' | ')} |`,
  ];
  for (const scenario of scenarios) {
    const cells = models.map((model) =>
      verdict(
        results.find(
          (item) => item.recording.scenarioId === scenario && item.recording.subjectModel === model,
        ),
      ),
    );
    lines.push(`| ${[scenario, ...cells].map(cell).join(' | ')} |`);
  }
  const findings = results.flatMap(findingLines);
  lines.push('', '## Concerns', '', ...(findings.length ? findings : ['None.']));
  return `${lines.join('\n')}\n`;
}
