import type { TodoAlpha4 } from '@eddo/core-server';

export interface ReportDetails {
  _id: string;
  link: string | null;
  parentId?: string | null;
  blockedBy?: string[];
}

interface BoundedReportDetails {
  fields: ReportDetails;
  truncated: boolean;
}

const ACTIONABILITY_TAGS = new Set([
  'gtd:blocked',
  'gtd:waiting',
  'gtd:calendar',
  'gtd:someday',
  'gtd:next',
  'gtd:project',
]);

/** Preserves actionability semantics when ordinary tags exceed the report budget. */
export function reportTags(tags: readonly string[]): string[] {
  const ordered = [
    ...tags.filter((tag) => ACTIONABILITY_TAGS.has(tag)),
    ...tags.filter((tag) => !ACTIONABILITY_TAGS.has(tag)),
  ];
  return [...new Set(ordered)].slice(0, 6).map((tag) => tag.slice(0, 48));
}

/** Omits oversized references rather than returning a different URL or identifier. */
function boundedReference(value: string | null | undefined, limit: number): string | null {
  if (!value) return null;
  return value.length <= limit ? value : null;
}

/** Detects nonempty references omitted by the projection. */
function referenceDropped(value: string | null | undefined, bounded: string | null): boolean {
  return Boolean(value && value !== bounded);
}

/** Preserves bounded actionable references without truncating URLs or relationship identifiers. */
export function reportDetails(todo: TodoAlpha4): BoundedReportDetails {
  const link = boundedReference(todo.link, 512);
  const parentId = boundedReference(todo.parentId, 80);
  const blockedBy = todo.blockedBy?.filter((id) => id.length <= 80).slice(0, 5);
  return {
    fields: {
      _id: todo._id.slice(0, 80),
      link,
      ...(todo.parentId !== undefined ? { parentId } : {}),
      ...(blockedBy ? { blockedBy } : {}),
    },
    truncated: [
      referenceDropped(todo.link, link),
      referenceDropped(todo.parentId, parentId),
      todo.blockedBy?.length !== blockedBy?.length,
    ].some(Boolean),
  };
}
