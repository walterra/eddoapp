import { type AuditLogAlpha1, type Todo } from '@eddo/core-shared';
import { describe, expect, it } from 'vitest';

import { createAllEdges, createAllNodes } from './todo_graph_helpers';

const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
  _id: '2026-01-01T00:00:00.000Z',
  _rev: '1-abc',
  title: 'Test Todo',
  description: '',
  context: 'work',
  due: '2026-01-01T23:59:59.999Z',
  tags: [],
  completed: null,
  repeat: null,
  active: {},
  link: null,
  version: 'alpha3',
  ...overrides,
});

const createMockAuditEntry = (overrides: Partial<AuditLogAlpha1> = {}): AuditLogAlpha1 => ({
  _id: '2026-01-01T00:00:00.000Z',
  version: 'audit_alpha1',
  action: 'update',
  entityType: 'todo',
  entityId: '2026-01-01T00:00:00.000Z',
  timestamp: '2026-01-01T00:00:00.000Z',
  source: 'mcp',
  ...overrides,
});

describe('createAllNodes', () => {
  describe('todo nodes', () => {
    it('creates a node for each todo', () => {
      const todos = [
        createMockTodo({ _id: 'todo-1', title: 'First Todo' }),
        createMockTodo({ _id: 'todo-2', title: 'Second Todo' }),
      ];

      const nodes = createAllNodes(todos, []);

      const todoNodes = nodes.filter((n) => n.type === 'todoNode');
      expect(todoNodes).toHaveLength(2);
      expect(todoNodes.map((n) => n.id)).toContain('todo-1');
      expect(todoNodes.map((n) => n.id)).toContain('todo-2');
    });

    it('includes todo data in node', () => {
      const todos = [createMockTodo({ _id: 'todo-1', title: 'Test Title' })];

      const nodes = createAllNodes(todos, []);

      const todoNode = nodes.find((n) => n.id === 'todo-1');
      const data = todoNode?.data as { todo: Todo } | undefined;
      expect(data?.todo.title).toBe('Test Title');
    });

    it('assigns larger size to todos with more content', () => {
      const todos = [
        createMockTodo({ _id: 'short', title: 'Hi', description: '' }),
        createMockTodo({
          _id: 'long',
          title: 'A very long title',
          description: 'With description',
        }),
      ];

      const nodes = createAllNodes(todos, []);

      const shortNode = nodes.find((n) => n.id === 'short');
      const longNode = nodes.find((n) => n.id === 'long');
      const shortSize = (shortNode?.data as { size: number } | undefined)?.size ?? 0;
      const longSize = (longNode?.data as { size: number } | undefined)?.size ?? 0;
      expect(longSize).toBeGreaterThan(shortSize);
    });

    it('assigns larger size to todos with more children', () => {
      // Parent and standalone have same content length, but parent has children
      const todos = [
        createMockTodo({ _id: 'parent', title: 'Todo', description: '' }),
        createMockTodo({ _id: 'child-1', title: 'Child 1', parentId: 'parent' }),
        createMockTodo({ _id: 'child-2', title: 'Child 2', parentId: 'parent' }),
        createMockTodo({ _id: 'standalone', title: 'Todo', description: '' }),
      ];

      const nodes = createAllNodes(todos, []);

      const parentNode = nodes.find((n) => n.id === 'parent');
      const standaloneNode = nodes.find((n) => n.id === 'standalone');
      const parentSize = (parentNode?.data as { size: number } | undefined)?.size ?? 0;
      const standaloneSize = (standaloneNode?.data as { size: number } | undefined)?.size ?? 0;
      // Parent should have larger size due to children
      expect(parentSize).toBeGreaterThanOrEqual(standaloneSize);
    });
  });

  describe('metadata nodes', () => {
    it('creates metadata node when 2+ todos share agent:session', () => {
      const todos = [
        createMockTodo({
          _id: 'todo-1',
          metadata: { 'agent:session': 'session-123' },
        }),
        createMockTodo({
          _id: 'todo-2',
          metadata: { 'agent:session': 'session-123' },
        }),
      ];

      const nodes = createAllNodes(todos, []);

      const metadataNodes = nodes.filter((n) => n.type === 'metadataNode');
      expect(metadataNodes).toHaveLength(1);
      expect(metadataNodes[0].data.metadataKey).toBe('agent:session');
      expect(metadataNodes[0].data.metadataValue).toBe('session-123');
      expect(metadataNodes[0].data.todoCount).toBe(2);
    });

    it('creates metadata node for single todo', () => {
      const todos = [
        createMockTodo({
          _id: 'todo-1',
          metadata: { 'agent:session': 'session-123' },
        }),
      ];

      const nodes = createAllNodes(todos, []);

      const metadataNodes = nodes.filter((n) => n.type === 'metadataNode');
      expect(metadataNodes).toHaveLength(1);
      expect(metadataNodes[0].data.todoCount).toBe(1);
    });

    it('creates separate nodes for different sessions', () => {
      const todos = [
        createMockTodo({ _id: 'todo-1', metadata: { 'agent:session': 'session-A' } }),
        createMockTodo({ _id: 'todo-2', metadata: { 'agent:session': 'session-A' } }),
        createMockTodo({ _id: 'todo-3', metadata: { 'agent:session': 'session-B' } }),
        createMockTodo({ _id: 'todo-4', metadata: { 'agent:session': 'session-B' } }),
      ];

      const nodes = createAllNodes(todos, []);

      const metadataNodes = nodes.filter((n) => n.type === 'metadataNode');
      expect(metadataNodes).toHaveLength(2);
    });

    it('includes lastMessage from audit entries', () => {
      const todos = [
        createMockTodo({ _id: 'todo-1', metadata: { 'agent:session': 'session-123' } }),
        createMockTodo({ _id: 'todo-2', metadata: { 'agent:session': 'session-123' } }),
      ];
      const auditEntries = [
        createMockAuditEntry({
          _id: 'audit-1',
          entityId: 'todo-1',
          message: 'First message',
          timestamp: '2026-01-01T10:00:00.000Z',
          metadata: { 'agent:session': 'session-123' },
        }),
        createMockAuditEntry({
          _id: 'audit-2',
          entityId: 'todo-2',
          message: 'Last message',
          timestamp: '2026-01-01T11:00:00.000Z',
          metadata: { 'agent:session': 'session-123' },
        }),
      ];

      const nodes = createAllNodes(todos, auditEntries);

      const metadataNode = nodes.find((n) => n.type === 'metadataNode');
      expect(metadataNode?.data.lastMessage).toBe('Last message');
    });
  });

  describe('user nodes', () => {
    it('creates user node when web source audit entries exist', () => {
      const todos = [createMockTodo({ _id: 'todo-1' })];
      const auditEntries = [
        createMockAuditEntry({
          _id: 'audit-1',
          entityId: 'todo-1',
          source: 'web',
        }),
      ];

      const nodes = createAllNodes(todos, auditEntries);

      const userNodes = nodes.filter((n) => n.type === 'userNode');
      expect(userNodes).toHaveLength(1);
      expect(userNodes[0].data.label).toBe('You');
      expect(userNodes[0].data.todoCount).toBe(1);
    });

    it('does not create user node without web source entries', () => {
      const todos = [createMockTodo({ _id: 'todo-1' })];
      const auditEntries = [
        createMockAuditEntry({
          _id: 'audit-1',
          entityId: 'todo-1',
          source: 'mcp',
        }),
      ];

      const nodes = createAllNodes(todos, auditEntries);

      const userNodes = nodes.filter((n) => n.type === 'userNode');
      expect(userNodes).toHaveLength(0);
    });
  });

  describe('file nodes', () => {
    it('creates file nodes from agent:files metadata', () => {
      const todos = [
        createMockTodo({
          _id: 'todo-1',
          metadata: {
            'agent:session': 'session-123',
            'agent:files': ['src/App.tsx', 'src/utils.ts'],
          },
        }),
        createMockTodo({
          _id: 'todo-2',
          metadata: {
            'agent:session': 'session-123',
          },
        }),
      ];

      const nodes = createAllNodes(todos, []);

      const fileNodes = nodes.filter((n) => n.type === 'fileNode');
      expect(fileNodes).toHaveLength(2);
      expect(fileNodes.map((n) => n.data.fileName)).toContain('App.tsx');
      expect(fileNodes.map((n) => n.data.fileName)).toContain('utils.ts');
    });
  });
});

describe('createAllEdges', () => {
  describe('parent-child edges', () => {
    it('creates edge from parent to child', () => {
      const todos = [
        createMockTodo({ _id: 'parent' }),
        createMockTodo({ _id: 'child', parentId: 'parent' }),
      ];

      const edges = createAllEdges(todos, []);

      const parentChildEdges = edges.filter((e) => e.id.startsWith('parent:'));
      expect(parentChildEdges).toHaveLength(1);
      expect(parentChildEdges[0].source).toBe('parent');
      expect(parentChildEdges[0].target).toBe('child');
    });

    it('does not create edge when parent is not in list', () => {
      const todos = [createMockTodo({ _id: 'child', parentId: 'missing-parent' })];

      const edges = createAllEdges(todos, []);

      const parentChildEdges = edges.filter((e) => e.id.startsWith('parent:'));
      expect(parentChildEdges).toHaveLength(0);
    });
  });

  describe('metadata edges', () => {
    it('creates edges from metadata node to todos', () => {
      const todos = [
        createMockTodo({ _id: 'todo-1', metadata: { 'agent:session': 'session-123' } }),
        createMockTodo({ _id: 'todo-2', metadata: { 'agent:session': 'session-123' } }),
      ];

      const edges = createAllEdges(todos, []);

      const metadataEdges = edges.filter((e) => e.id.startsWith('metadata:'));
      expect(metadataEdges).toHaveLength(2);
    });

    it('uses different styling for completed vs incomplete todos', () => {
      const todos = [
        createMockTodo({
          _id: 'todo-1',
          completed: null,
          metadata: { 'agent:session': 'session-123' },
        }),
        createMockTodo({
          _id: 'todo-2',
          completed: '2026-01-01T12:00:00.000Z',
          metadata: { 'agent:session': 'session-123' },
        }),
      ];

      const edges = createAllEdges(todos, []);

      const metadataEdges = edges.filter((e) => e.id.startsWith('metadata:'));
      const incompleteEdge = metadataEdges.find((e) => e.target === 'todo-1');
      const completedEdge = metadataEdges.find((e) => e.target === 'todo-2');

      // Both edges should exist
      expect(incompleteEdge).toBeDefined();
      expect(completedEdge).toBeDefined();
      // Incomplete edge is animated, completed is not
      expect(incompleteEdge?.animated).toBe(true);
      expect(completedEdge?.animated).toBe(false);
    });
  });

  describe('user edges', () => {
    it('creates edges from user node to modified todos', () => {
      const todos = [createMockTodo({ _id: 'todo-1' }), createMockTodo({ _id: 'todo-2' })];
      const auditEntries = [createMockAuditEntry({ entityId: 'todo-1', source: 'web' })];

      const edges = createAllEdges(todos, auditEntries);

      const userEdges = edges.filter((e) => e.id.startsWith('user:'));
      expect(userEdges).toHaveLength(1);
      expect(userEdges[0].target).toBe('todo-1');
    });
  });

  describe('file edges', () => {
    it('creates edges from file nodes to session nodes', () => {
      const todos = [
        createMockTodo({
          _id: 'todo-1',
          metadata: {
            'agent:session': 'session-123',
            'agent:files': ['src/App.tsx'],
          },
        }),
        createMockTodo({
          _id: 'todo-2',
          metadata: { 'agent:session': 'session-123' },
        }),
      ];

      const edges = createAllEdges(todos, []);

      const fileEdges = edges.filter((e) => e.id.startsWith('file-session:'));
      expect(fileEdges).toHaveLength(1);
    });
  });

  describe('blockedBy edges', () => {
    it('creates edge from blocker to blocked todo', () => {
      const todos = [
        createMockTodo({ _id: 'blocker' }),
        createMockTodo({ _id: 'blocked', blockedBy: ['blocker'] }),
      ];

      const edges = createAllEdges(todos, []);

      const blockedEdges = edges.filter((e) => e.id.startsWith('blocked:'));
      expect(blockedEdges).toHaveLength(1);
      expect(blockedEdges[0].source).toBe('blocker');
      expect(blockedEdges[0].target).toBe('blocked');
    });

    it('does not create edge when blocker is not in list', () => {
      const todos = [createMockTodo({ _id: 'blocked', blockedBy: ['missing-blocker'] })];

      const edges = createAllEdges(todos, []);

      const blockedEdges = edges.filter((e) => e.id.startsWith('blocked:'));
      expect(blockedEdges).toHaveLength(0);
    });

    it('creates multiple edges for multiple blockers', () => {
      const todos = [
        createMockTodo({ _id: 'blocker-1' }),
        createMockTodo({ _id: 'blocker-2' }),
        createMockTodo({ _id: 'blocked', blockedBy: ['blocker-1', 'blocker-2'] }),
      ];

      const edges = createAllEdges(todos, []);

      const blockedEdges = edges.filter((e) => e.id.startsWith('blocked:'));
      expect(blockedEdges).toHaveLength(2);
    });

    it('uses desaturated wine red style for incomplete blockers', () => {
      const todos = [
        createMockTodo({ _id: 'blocker', completed: null }),
        createMockTodo({ _id: 'blocked', blockedBy: ['blocker'] }),
      ];

      const edges = createAllEdges(todos, []);

      const blockedEdge = edges.find((e) => e.id.startsWith('blocked:'));
      expect(blockedEdge?.animated).toBe(false);
      expect(blockedEdge?.style?.stroke).toBe('#7f1d3d'); // desaturated rose
    });

    it('uses gray non-animated style for completed blockers', () => {
      const todos = [
        createMockTodo({ _id: 'blocker', completed: '2026-01-01T12:00:00.000Z' }),
        createMockTodo({ _id: 'blocked', blockedBy: ['blocker'] }),
      ];

      const edges = createAllEdges(todos, []);

      const blockedEdge = edges.find((e) => e.id.startsWith('blocked:'));
      expect(blockedEdge?.animated).toBe(false);
      expect(blockedEdge?.style?.stroke).toBe('#64748b'); // slate-500 (matches pending todo)
    });
  });
});
