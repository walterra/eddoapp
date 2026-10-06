export interface ReferenceNote {
  content: string;
}

export interface ReferenceTodo {
  _id: string;
  _rev?: string;
  version?: string;
  due?: string;
  title?: string;
  description?: string;
  context?: string;
  tags?: string[];
  active?: Record<string, string | null>;
  completed?: string | null;
  parentId?: string | null;
  blockedBy?: string[];
  notes?: ReferenceNote[];
  metadata?: Record<string, string | string[]>;
  scheduledTime?: string | null;
  _attachments?: Record<string, ReferenceAttachment>;
}

export interface ReferenceAttachment {
  length?: number;
}

export interface NumericSummary {
  count: number;
  sum: number;
  minimum: number;
  median: number;
  p90: number;
  p95: number;
  maximum: number;
  histogram: Record<string, number>;
}

export interface ReferenceFamily {
  parentDue: string;
  childDue: string[];
  count: number;
}

export interface RelationshipSummary {
  children: number;
  parents: number;
  danglingParents: number;
  cyclicPaths: number;
  crossDayEdges: number;
  childrenPerParent: NumericSummary;
  depth: NumericSummary;
  nodesByDepthAndChildren: Record<string, number>;
  dayDistance: NumericSummary;
  families: ReferenceFamily[];
}

export interface ReferenceStatistics {
  totalTodos: number;
  versions: Record<string, number>;
  completed: number;
  contexts: number;
  tags: number;
  documentBytes: NumericSummary;
  descriptionBytes: NumericSummary;
  titleBytes: NumericSummary;
  notesPerTodo: NumericSummary;
  noteBytes: NumericSummary;
  metadataBytes: NumericSummary;
  activityEntries: NumericSummary;
  activityWindows: Record<string, number>;
  contextSizes: NumericSummary;
  activeTimers: number;
  scheduledTodos: number;
  tagsPerTodo: NumericSummary;
  dependenciesPerTodo: NumericSummary;
  danglingDependencies: number;
  dueDates: Record<string, number>;
  undatedTodos: number;
  todosPerPopulatedDay: NumericSummary;
  relationships: RelationshipSummary;
}
