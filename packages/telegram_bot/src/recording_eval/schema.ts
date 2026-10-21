import { z } from 'zod';

export const CRITERIA = [
  'task_fulfillment',
  'claims_grounded_in_results',
  'instruction_compliance',
  'error_recovery',
  'communication_quality',
] as const;

export const judgmentSchema = z.strictObject({
  criterion: z.enum(CRITERIA),
  verdict: z.enum(['pass', 'partial', 'fail', 'not_applicable', 'insufficient_evidence']),
  explanation: z.string().min(1).max(1500),
  evidenceIds: z.array(z.string().min(1)).max(30),
});

export const reviewSchema = z.strictObject({
  schemaVersion: z.literal(1),
  judgments: z.array(judgmentSchema).length(CRITERIA.length),
});

export const REVIEW_JSON_SCHEMA = z.toJSONSchema(reviewSchema);
export type Review = z.infer<typeof reviewSchema>;

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
