import { createModels } from '@earendil-works/pi-ai/models';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';
import { renderReport } from './report.js';
import { reviewRecording } from './reviewer.js';
import { CRITERIA, validateReview, type Recording, type Review } from './schema.js';

const recording: Recording = {
  path: 'sample.json',
  sha256: 'hash',
  scenarioId: 'sample',
  subjectModel: 'test/subject',
  events: [
    {
      id: 'event-1',
      interaction: 0,
      source: 'response.message',
      role: 'assistant',
      content: 'Created | task',
    },
  ],
};

function review(): Review {
  return {
    schemaVersion: 1,
    judgments: CRITERIA.map((criterion) => ({
      criterion,
      verdict: 'pass',
      explanation: 'Supported by the recording.',
      evidenceIds: ['event-1'],
    })),
  };
}

function fixture() {
  const models = createModels();
  const provider = fauxProvider();
  models.setProvider(provider.provider);
  return { models, provider, model: provider.getModel() };
}

describe('structured recording review', () => {
  it('accepts one schema-defined submission without executing tools', async () => {
    const test = fixture();
    test.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('submit_review', review()), { stopReason: 'toolUse' }),
    ]);
    expect(await reviewRecording(test.models, test.model, recording)).toEqual(review());
    expect(test.provider.state.callCount).toBe(1);
  });

  it('rejects prose, failed responses, and unrelated tools', async () => {
    const test = fixture();
    test.provider.setResponses([
      fauxAssistantMessage('Looks good'),
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'Unavailable' }),
      fauxAssistantMessage(fauxToolCall('deleteTodo', {}), { stopReason: 'toolUse' }),
    ]);
    for (let index = 0; index < 3; index += 1)
      await expect(reviewRecording(test.models, test.model, recording)).rejects.toThrow();
  });

  it('rejects unknown evidence, duplicate criteria, missing evidence, and extra fields', () => {
    const unknown = review();
    unknown.judgments[0].evidenceIds = ['invented'];
    expect(() => validateReview(unknown, recording)).toThrow('Unknown evidence');
    const duplicate = review();
    duplicate.judgments[1].criterion = duplicate.judgments[0].criterion;
    expect(() => validateReview(duplicate, recording)).toThrow('Duplicate');
    const missing = review();
    missing.judgments[0].evidenceIds = [];
    expect(() => validateReview(missing, recording)).toThrow('require evidence');
    expect(() => validateReview({ ...review(), score: 100 }, recording)).toThrow();
  });

  it('allows uncertainty without forcing a verdict', () => {
    const uncertain = review();
    uncertain.judgments[0].verdict = 'insufficient_evidence';
    uncertain.judgments[0].evidenceIds = [];
    expect(validateReview(uncertain, recording)).toEqual(uncertain);
  });

  it('keeps full evidence in JSON and shows only concerns and errors in Markdown', () => {
    const report = renderReport([
      { status: 'completed', recording, review: review() },
      { status: 'error', recording, error: 'Provider unavailable' },
    ]);
    expect(report).not.toContain('Created');
    expect(report).not.toContain('Supported by the recording.');
    expect(report).toContain('[review.json](review.json)');
    expect(report).toContain('Provider unavailable');
  });
});
