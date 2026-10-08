import type {
  NumericSummary,
  ReferenceFamily,
  ReferenceStatistics,
  ReferenceTodo,
  RelationshipSummary,
} from './reference_types';

/** Returns a frequency table without retaining source document content. */
export function histogram(values: readonly (string | number)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[String(value)] = (counts[String(value)] ?? 0) + 1;
  return counts;
}

/** Summarizes an empirical distribution using nearest-rank quantiles. */
export function summarize(values: readonly number[]): NumericSummary {
  const sorted = [...values].sort((left, right) => left - right);
  const quantile = (fraction: number): number =>
    sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return {
    count: sorted.length,
    sum: sorted.reduce((sum, value) => sum + value, 0),
    minimum: sorted[0] ?? 0,
    median: quantile(0.5),
    p90: quantile(0.9),
    p95: quantile(0.95),
    maximum: sorted.at(-1) ?? 0,
    histogram: histogram(values),
  };
}

/** Calculates parent depth and identifies malformed cyclic paths. */
function parentDepth(todo: ReferenceTodo, byId: ReadonlyMap<string, ReferenceTodo>): number {
  const visited = new Set<string>([todo._id]);
  let current = todo;
  let depth = 0;
  while (current.parentId && byId.has(current.parentId)) {
    if (visited.has(current.parentId)) return -1;
    visited.add(current.parentId);
    current = byId.get(current.parentId)!;
    depth++;
  }
  return depth;
}

/** Groups family placements by dates without preserving source identifiers. */
function familyPlacements(todos: readonly ReferenceTodo[]): ReferenceFamily[] {
  const byId = new Map(todos.map((todo) => [todo._id, todo]));
  const children = new Map<string, string[]>();
  for (const todo of todos) {
    if (!todo.parentId || !byId.has(todo.parentId)) continue;
    const dates = children.get(todo.parentId) ?? [];
    dates.push(todo.due?.slice(0, 10) ?? '');
    children.set(todo.parentId, dates);
  }
  const counts = histogram(
    [...children].map(([parentId, dates]) =>
      JSON.stringify({
        parentDue: byId.get(parentId)?.due?.slice(0, 10) ?? '',
        childDue: [...dates].sort(),
      }),
    ),
  );
  return Object.entries(counts).map(([shape, count]) => ({ ...JSON.parse(shape), count }));
}

/** Summarizes hierarchy shape without exporting source IDs. */
export function relationships(todos: readonly ReferenceTodo[]): RelationshipSummary {
  const byId = new Map(todos.map((todo) => [todo._id, todo]));
  const children = todos.filter((todo) => !!todo.parentId);
  const childCounts = histogram(
    children.filter((todo) => byId.has(todo.parentId!)).map((todo) => todo.parentId!),
  );
  const depths = todos.map((todo) => parentDepth(todo, byId));
  const validEdges = children.filter((todo) => byId.has(todo.parentId!));
  const distances = validEdges
    .map((todo) => {
      const parent = byId.get(todo.parentId!)!;
      return Math.round(
        (Date.parse(todo.due?.slice(0, 10) ?? '') - Date.parse(parent.due?.slice(0, 10) ?? '')) /
          86400000,
      );
    })
    .filter(Number.isFinite);
  return {
    children: children.length,
    parents: Object.keys(childCounts).length,
    danglingParents: children.length - validEdges.length,
    cyclicPaths: depths.filter((depth) => depth < 0).length,
    crossDayEdges: distances.filter((distance) => distance !== 0).length,
    childrenPerParent: summarize(Object.values(childCounts)),
    depth: summarize(depths.filter((depth) => depth >= 0)),
    nodesByDepthAndChildren: histogram(
      todos.map((todo, index) => `${depths[index]}:${childCounts[todo._id] ?? 0}`),
    ),
    dayDistance: summarize(distances),
    families: familyPlacements(todos),
  };
}

const bytes = (value: unknown): number =>
  Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value ?? {}));

/** Produces workload aggregates without private strings or identifiers. */
export function analyzeReference(todos: readonly ReferenceTodo[]): ReferenceStatistics {
  const ids = new Set(todos.map((todo) => todo._id));
  const dueDates = histogram(todos.map((todo) => todo.due?.slice(0, 10) ?? 'missing'));
  return {
    totalTodos: todos.length,
    versions: histogram(todos.map((todo) => todo.version ?? 'missing')),
    completed: todos.filter((todo) => !!todo.completed).length,
    contexts: new Set(todos.map((todo) => todo.context)).size,
    tags: new Set(todos.flatMap((todo) => todo.tags ?? [])).size,
    documentBytes: summarize(todos.map(bytes)),
    descriptionBytes: summarize(todos.map((todo) => bytes(todo.description ?? ''))),
    titleBytes: summarize(todos.map((todo) => bytes(todo.title ?? ''))),
    notesPerTodo: summarize(todos.map((todo) => todo.notes?.length ?? 0)),
    noteBytes: summarize(
      todos.flatMap((todo) => (todo.notes ?? []).map((note) => bytes(note.content))),
    ),
    metadataBytes: summarize(todos.map((todo) => bytes(todo.metadata))),
    activityEntries: summarize(todos.map((todo) => Object.keys(todo.active ?? {}).length)),
    activityWindows: histogram(
      todos.flatMap((todo) =>
        Object.entries(todo.active ?? {}).map(([from, to]) =>
          JSON.stringify([from.slice(0, 10), to === null ? null : to.slice(0, 10)]),
        ),
      ),
    ),
    contextSizes: summarize(Object.values(histogram(todos.map((todo) => todo.context ?? '')))),
    activeTimers: todos.reduce(
      (count, todo) =>
        count + Object.values(todo.active ?? {}).filter((value) => value === null).length,
      0,
    ),
    scheduledTodos: todos.filter((todo) => !!todo.scheduledTime).length,
    tagsPerTodo: summarize(todos.map((todo) => todo.tags?.length ?? 0)),
    dependenciesPerTodo: summarize(todos.map((todo) => todo.blockedBy?.length ?? 0)),
    danglingDependencies: todos.flatMap((todo) => todo.blockedBy ?? []).filter((id) => !ids.has(id))
      .length,
    dueDates,
    undatedTodos: dueDates[''] ?? 0,
    todosPerPopulatedDay: summarize(
      Object.entries(dueDates)
        .filter(([date]) => date !== '')
        .map(([, count]) => count),
    ),
    relationships: relationships(todos),
  };
}
