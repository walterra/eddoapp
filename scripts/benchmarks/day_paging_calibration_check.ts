import type { DayPagingProfile, SyntheticTodo } from './day_paging_fixture';
import { analyzeReference } from './reference_statistics';
import type { ReferenceStatistics, RelationshipSummary } from './reference_types';

export interface CalibrationCheck {
  matched: string[];
  sourceDocumentBytes: number;
  syntheticDocumentBytes: number;
  documentSizeDifferencePercent: number;
  limitations: string[];
}

/** Compares unordered histogram entries deterministically. */
function canonical(value: Record<string, number>): string {
  return JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

/** Canonicalizes hierarchy aggregates without depending on document order. */
function hierarchySignature(summary: RelationshipSummary): string {
  const families = Object.fromEntries(
    summary.families.map((family) => [
      JSON.stringify({
        parentDue: family.parentDue,
        childDue: [...family.childDue].sort(),
      }),
      family.count,
    ]),
  );
  return JSON.stringify([
    summary.children,
    summary.parents,
    summary.danglingParents,
    summary.cyclicPaths,
    summary.crossDayEdges,
    canonical(summary.childrenPerParent.histogram),
    canonical(summary.depth.histogram),
    canonical(summary.nodesByDepthAndChildren),
    canonical(summary.dayDistance.histogram),
    canonical(families),
  ]);
}

/** Rejects fixture drift against measured counts and empirical distributions. */
function assertMatches(actual: ReferenceStatistics, reference: ReferenceStatistics): string[] {
  const counts = [
    'totalTodos',
    'completed',
    'contexts',
    'tags',
    'scheduledTodos',
    'activeTimers',
    'undatedTodos',
  ] as const;
  const distributions = [
    'descriptionBytes',
    'activityEntries',
    'notesPerTodo',
    'noteBytes',
    'metadataBytes',
    'tagsPerTodo',
    'contextSizes',
  ] as const;
  for (const key of counts) {
    if (actual[key] !== reference[key]) throw new Error(`Calibration count mismatch: ${key}`);
  }
  for (const key of distributions) {
    if (canonical(actual[key].histogram) !== canonical(reference[key].histogram)) {
      throw new Error(`Calibration histogram mismatch: ${key}`);
    }
  }
  if (canonical(actual.activityWindows) !== canonical(reference.activityWindows))
    throw new Error('Calibration activity timeline mismatch');
  if (canonical(actual.dueDates) !== canonical(reference.dueDates))
    throw new Error('Calibration date-density mismatch');
  if (hierarchySignature(actual.relationships) !== hierarchySignature(reference.relationships)) {
    throw new Error('Calibration parent-child shape mismatch');
  }
  return [...counts, ...distributions, 'dueDates', 'activityWindows', 'relationships'];
}

/** Reports calibrated dimensions separately from unmodeled correlations. */
export function checkCalibration(
  profile: DayPagingProfile,
  docs: readonly SyntheticTodo[],
): CalibrationCheck | undefined {
  if (!profile.calibration) return undefined;
  const actual = analyzeReference(docs);
  const matched = assertMatches(actual, profile.calibration);
  const sourceDocumentBytes = profile.calibration.documentBytes.sum;
  const syntheticDocumentBytes = actual.documentBytes.sum;
  return {
    matched,
    sourceDocumentBytes,
    syntheticDocumentBytes,
    documentSizeDifferencePercent: (syntheticDocumentBytes / sourceDocumentBytes - 1) * 100,
    limitations: [
      'Independent marginals do not preserve all field correlations',
      'Activity time-of-day and durations are synthetic; date spans are matched',
      'Tag popularity and title lengths are not matched',
      'Attachments, tombstones, and revision history are not generated',
    ],
  };
}
