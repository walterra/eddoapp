/**
 * Helpers for dependency-focused graph visualization.
 * Selects connected todos via parent/child and blockedBy relationships.
 */
import type { Todo } from '@eddo/core-shared';

/**
 * Add a bidirectional relationship between two todo IDs.
 */
const addRelation = (graph: Map<string, Set<string>>, a: string, b: string): void => {
  const aSet = graph.get(a) ?? new Set<string>();
  aSet.add(b);
  graph.set(a, aSet);

  const bSet = graph.get(b) ?? new Set<string>();
  bSet.add(a);
  graph.set(b, bSet);
};

/**
 * Build an undirected relationship graph from parent/child and blockedBy links.
 */
const buildDependencyGraph = (todos: readonly Todo[]): Map<string, Set<string>> => {
  const graph = new Map<string, Set<string>>();

  for (const todo of todos) {
    if (!graph.has(todo._id)) {
      graph.set(todo._id, new Set<string>());
    }

    if (todo.parentId) {
      addRelation(graph, todo._id, todo.parentId);
    }

    for (const blockerId of todo.blockedBy ?? []) {
      addRelation(graph, todo._id, blockerId);
    }
  }

  return graph;
};

/**
 * Select todos connected to a root todo through dependency relationships.
 * Traverses parent/child and blockedBy links in both directions.
 */
export const selectDependencyTodos = (todos: readonly Todo[], rootTodoId: string): Todo[] => {
  const todoMap = new Map(todos.map((todo) => [todo._id, todo]));
  if (!todoMap.has(rootTodoId)) {
    return [];
  }

  const dependencyGraph = buildDependencyGraph(todos);
  const visited = new Set<string>();
  const queue: string[] = [rootTodoId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    const neighbors = dependencyGraph.get(currentId);
    if (!neighbors) {
      continue;
    }

    for (const neighborId of neighbors) {
      if (!todoMap.has(neighborId) || visited.has(neighborId)) {
        continue;
      }
      queue.push(neighborId);
    }
  }

  return todos.filter((todo) => visited.has(todo._id));
};
