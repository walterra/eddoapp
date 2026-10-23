import { describe, expect, it } from 'vitest';
import { renderReport, type ReviewResult } from './report.js';
import { CRITERIA, type Review } from './schema.js';

function result(model: string, verdict: Review['judgments'][number]['verdict']): ReviewResult {
  return {
    status: 'completed',
    recording: {
      path: 'test.json',
      sha256: 'hash',
      subjectModel: model,
      scenarioId: 'shopping',
      events: [],
    },
    review: {
      schemaVersion: 1,
      judgments: CRITERIA.map((criterion) => ({
        criterion,
        verdict: criterion === 'task_fulfillment' ? verdict : 'pass',
        explanation: 'Review finding.',
        evidenceIds: ['event-1'],
      })),
    },
  };
}

describe('concise recording report', () => {
  it('compares both models in one scenario row and hides passing explanations', () => {
    const report = renderReport([result('model-a', 'pass'), result('model-b', 'partial')]);
    expect(report).toContain('| shopping | Pass | Concern |');
    expect(report.match(/Review finding\./g)).toHaveLength(1);
    expect(report).toContain('event-1');
    expect(report).not.toContain('communication_quality');
  });

  it('distinguishes failures and missing evidence', () => {
    const report = renderReport([
      result('model-a', 'fail'),
      result('model-b', 'insufficient_evidence'),
    ]);
    expect(report).toContain('| shopping | Fail | Unclear |');
  });

  it('caps verbose older explanations without changing stored findings', () => {
    const input = result('model-a', 'partial');
    input.review!.judgments[0].explanation = 'Long explanation '.repeat(80);
    const original = input.review!.judgments[0].explanation;
    const report = renderReport([input]);
    expect(report).not.toContain(original);
    expect(report).toContain('...');
    expect(input.review!.judgments[0].explanation).toBe(original);
  });

  it('says when there are no concerns', () => {
    expect(renderReport([result('model-a', 'pass')])).toContain('## Concerns\n\nNone.');
  });
});
