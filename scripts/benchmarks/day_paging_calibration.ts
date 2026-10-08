import type { DayPagingProfile, SyntheticTodo } from './day_paging_fixture';
import type { NumericSummary, ReferenceStatistics } from './reference_types';

/** Expands and deterministically shuffles an empirical histogram. */
function expand(summary: NumericSummary, seed: number): number[] {
  const values = Object.entries(summary.histogram).flatMap(([value, count]) =>
    Array<number>(count).fill(Number(value)),
  );
  return shuffle(values, seed);
}

/** Shuffles generated samples without mutating reference aggregates. */
function shuffle<T>(values: T[], seed: number): T[] {
  let state = seed >>> 0;
  for (let index = values.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

type ActivityWindow = [string, string | null];

interface CalibrationSamples {
  descriptions: number[];
  activities: number[];
  notes: number[];
  noteSizes: number[];
  metadata: number[];
  tags: number[];
  contexts: number[];
  windows: ActivityWindow[];
}

/** Builds sampled marginal distributions without private source values. */
function getSamples(reference: ReferenceStatistics, seed: number): CalibrationSamples {
  return {
    descriptions: expand(reference.descriptionBytes, seed),
    activities: expand(reference.activityEntries, seed + 1),
    notes: expand(reference.notesPerTodo, seed + 2),
    noteSizes: expand(reference.noteBytes, seed + 3),
    metadata: expand(reference.metadataBytes, seed + 4),
    tags: expand(reference.tagsPerTodo, seed + 5),
    contexts: shuffle(
      expand(reference.contextSizes, seed + 6).flatMap((count, index) =>
        Array<number>(count).fill(index),
      ),
      seed + 7,
    ),
    windows: shuffle(
      Object.entries(reference.activityWindows).flatMap(([window, count]) =>
        Array.from({ length: count }, () => JSON.parse(window) as ActivityWindow),
      ),
      seed + 8,
    ),
  };
}

/** Generates a calibrated workload from aggregate statistics only. */
export function generateCalibrated(profile: DayPagingProfile): SyntheticTodo[] {
  const reference = profile.calibration!;
  validateSupportedReference(reference);
  const samples = getSamples(reference, profile.seed);
  const dueDates = Object.entries(reference.dueDates)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([date, count]) => Array<string>(count).fill(date));
  let noteIndex = 0;
  let tagIndex = 0;
  let activityIndex = 0;
  const docs = dueDates.map((due, index): SyntheticTodo => {
    const notes = Array.from({ length: samples.notes[index] }, () => {
      const id = noteIndex++;
      return {
        id: `synthetic-note-${id}`,
        content: 'x'.repeat(samples.noteSizes[id]),
        createdAt: `${profile.referenceDate}T09:00:00.000Z`,
      };
    });
    const active = buildActivities(
      samples.windows.slice(activityIndex, activityIndex + samples.activities[index]),
      activityIndex,
    );
    activityIndex += samples.activities[index];
    return {
      _id: new Date(Date.UTC(2020, 0, 1) + index * 1000 + profile.seed).toISOString(),
      version: 'alpha4',
      title: `Benchmark ${due || 'undated'} item ${index}`,
      description: 'x'.repeat(samples.descriptions[index]),
      due,
      context: `context-${samples.contexts[index]}`,
      tags: Array.from({ length: samples.tags[index] }, () => `tag-${tagIndex++ % reference.tags}`),
      active,
      completed: index < reference.completed ? `${profile.referenceDate}T18:00:00.000Z` : null,
      repeat: null,
      link: null,
      notes,
      metadata: buildMetadata(samples.metadata[index]),
      scheduledTime: index < reference.scheduledTodos ? '09:00' : null,
      scheduledTimeZone: null,
    };
  });
  return assignFamilies(docs, reference);
}

/** Rejects reference shapes not implemented by this calibration generator. */
function validateSupportedReference(reference: ReferenceStatistics): void {
  if (!reference.activityWindows || !reference.contextSizes) {
    throw new Error(
      'Reference profile predates timeline calibration; rerun benchmark:profile-reference',
    );
  }
  if (
    reference.relationships.depth.maximum > 1 ||
    reference.relationships.cyclicPaths ||
    reference.relationships.danglingParents
  ) {
    throw new Error(
      'Reference requires unsupported nested, cyclic, or dangling-parent calibration',
    );
  }
  if (
    reference.dependenciesPerTodo.sum ||
    Object.keys(reference.versions).some((version) => version !== 'alpha4')
  ) {
    throw new Error('Reference requires dependency or legacy-schema calibration');
  }
}

/** Preserves activity date spans while replacing private timestamps. */
function buildActivities(
  windows: readonly ActivityWindow[],
  startIndex: number,
): Record<string, string | null> {
  return Object.fromEntries(
    windows.map(([from, to], index) => {
      const offset = ((startIndex + index) % 86400) * 1000;
      const start = new Date(Date.parse(`${from}T00:00:00.000Z`) + offset);
      const end =
        to === null
          ? null
          : new Date(
              Date.parse(`${to}T00:00:00.000Z`) + Math.min(offset + 60000, 86399000),
            ).toISOString();
      return [start.toISOString(), end];
    }),
  );
}

/** Preserves serialized metadata sizes using synthetic strings. */
function buildMetadata(size: number): Record<string, string> | undefined {
  if (size === 2) return undefined;
  if (size < 8) throw new Error('Unsupported metadata size');
  return { k: 'x'.repeat(size - 8) };
}

/** Preserves family fan-out and cross-day placements without source IDs. */
function assignFamilies(docs: SyntheticTodo[], reference: ReferenceStatistics): SyntheticTodo[] {
  const buckets = new Map<string, SyntheticTodo[]>();
  for (const doc of docs) {
    const bucket = buckets.get(doc.due) ?? [];
    bucket.push(doc);
    buckets.set(doc.due, bucket);
  }
  const take = (date: string): SyntheticTodo => {
    const doc = buckets.get(date)?.shift();
    if (!doc) throw new Error(`Insufficient synthetic documents for family placement on ${date}`);
    return doc;
  };
  const assignments = reference.relationships.families.flatMap((family) =>
    Array.from({ length: family.count }, () => ({
      parent: take(family.parentDue),
      dates: family.childDue,
    })),
  );
  const parents = new Map<string, string>();
  for (const family of assignments) {
    for (const date of family.dates) parents.set(take(date)._id, family.parent._id);
  }
  return docs.map((doc) =>
    parents.has(doc._id) ? { ...doc, parentId: parents.get(doc._id) } : doc,
  );
}
