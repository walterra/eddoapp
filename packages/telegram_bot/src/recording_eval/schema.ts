import { validateTextLength } from '@eddo/core-shared/validation/compatibility';
import {
  arr,
  createSchemaParser,
  lit,
  obj,
  oneOf,
  str,
} from '@eddo/core-shared/validation/schema_parser';

export const CRITERIA = [
  'task_fulfillment',
  'claims_grounded_in_results',
  'instruction_compliance',
  'error_recovery',
  'communication_quality',
] as const;

const judgmentDefinition = obj({
  criterion: oneOf(CRITERIA),
  verdict: oneOf(['pass', 'partial', 'fail', 'not_applicable', 'insufficient_evidence']),
  explanation: str({ minLength: 1, maxLength: 1500 }),
  evidenceIds: arr(str({ minLength: 1 }), { maxItems: 30 }),
});
export const judgmentSchema = createSchemaParser(judgmentDefinition, {
  validate: (value) => validateTextLength(value.explanation, 1500, '/explanation'),
});
const reviewDefinition = obj({
  schemaVersion: lit(1),
  judgments: arr(judgmentDefinition, { minItems: CRITERIA.length, maxItems: CRITERIA.length }),
});
export const reviewSchema = createSchemaParser(reviewDefinition, {
  validate: (value) =>
    value.judgments.flatMap((judgment, index) =>
      validateTextLength(judgment.explanation, 1500, `/judgments/${index}/explanation`),
    ),
});

export const REVIEW_JSON_SCHEMA: Record<string, unknown> = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...reviewDefinition,
};
export type Review = ReturnType<typeof reviewSchema.parse>;

export interface EvidenceEvent {
  id: string;
  interaction: number;
  source: string;
  role: string;
  content: string;
}

export interface Recording {
  path: string;
  sha256: string;
  scenarioId: string;
  subjectModel: string;
  events: EvidenceEvent[];
}

/** Validates criterion coverage and source references independently of provider enforcement. */
export function validateReview(value: unknown, recording: Recording): Review {
  const review = reviewSchema.parse(value);
  const criteria = new Set(review.judgments.map((judgment) => judgment.criterion));
  if (criteria.size !== CRITERIA.length) throw new Error('Duplicate or missing review criteria');
  const ids = new Set(recording.events.map((event) => event.id));
  for (const judgment of review.judgments) {
    if (judgment.evidenceIds.some((id) => !ids.has(id))) throw new Error('Unknown evidence ID');
    if (['pass', 'partial', 'fail'].includes(judgment.verdict) && !judgment.evidenceIds.length)
      throw new Error('Substantive judgments require evidence');
  }
  return review;
}
