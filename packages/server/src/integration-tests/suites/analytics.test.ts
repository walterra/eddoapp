/**
 * Analytics and Server Info Integration Tests
 * Tests getServerInfo functionality and tag statistics
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { MCPTestServer } from '../setup/test-server.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import { createTestTodoData } from '../__fixtures__/todo-factory.js';
import type { TodoAlpha3 } from '../helpers/mcp-assertions.js';

describe('MCP Analytics Integration', () => {
  let testServer: MCPTestServer;
  let assert: ReturnType<typeof createMCPAssertions>;

  beforeEach(async () => {
    testServer = new MCPTestServer();
    await testServer.waitForServer();
    assert = createMCPAssertions(testServer);
    
    // Reset test data
    await testServer.resetTestData();
  });

  afterEach(async () => {
    await testServer.stop();
  });

  describe('Server Information', () => {
    it('should provide server information with all sections', async () => {
      const serverInfo = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'all' }
      );

      assert.expectValidServerInfo(serverInfo);
      
      // Should contain basic server information
      expect(serverInfo).toBeDefined();
      expect(typeof serverInfo).toBe('object');
    });

    it('should provide tag statistics section', async () => {
      // Create todos with various tags
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.withTags(['urgent', 'project', 'development']),
        title: 'Tagged Todo 1',
      });
      
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.withTags(['urgent', 'meeting']),
        title: 'Tagged Todo 2',
      });
      
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.withTags(['project', 'research']),
        title: 'Tagged Todo 3',
      });

      // Get tag statistics
      const tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );

      assert.expectValidTagStats(tagStats);
      
      // Verify expected tag counts
      expect(tagStats.urgent).toBe(2);
      expect(tagStats.project).toBe(2);
      expect(tagStats.development).toBe(1);
      expect(tagStats.meeting).toBe(1);
      expect(tagStats.research).toBe(1);
    });

    it('should handle empty tag statistics', async () => {
      // No todos with tags
      const tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );

      // Should return empty object or object with zero counts
      expect(typeof tagStats).toBe('object');
      
      // If not empty, all counts should be 0 or undefined
      for (const count of Object.values(tagStats)) {
        if (count !== undefined) {
          expect(count).toBe(0);
        }
      }
    });
  });

  describe('Tag Statistics Accuracy', () => {
    it('should accurately count tag occurrences', async () => {
      const testCases = [
        { tags: ['test', 'integration'], title: 'Test 1' },
        { tags: ['test', 'unit'], title: 'Test 2' },
        { tags: ['integration', 'e2e'], title: 'Test 3' },
        { tags: ['test', 'integration', 'e2e'], title: 'Test 4' },
        { tags: [], title: 'Test 5' }, // No tags
      ];

      // Create todos with various tag combinations
      for (const testCase of testCases) {
        await assert.expectToolCallSuccess('createTodo', {
          ...createTestTodoData.basic(),
          title: testCase.title,
          tags: testCase.tags,
        });
      }

      const tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );

      // Expected counts:
      // 'test': 3 occurrences
      // 'integration': 3 occurrences
      // 'unit': 1 occurrence
      // 'e2e': 2 occurrences
      expect(tagStats.test).toBe(3);
      expect(tagStats.integration).toBe(3);
      expect(tagStats.unit).toBe(1);
      expect(tagStats.e2e).toBe(2);
    });

    it('should update tag statistics when todos are modified', async () => {
      // Create todo with initial tags
      const todo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', {
        ...createTestTodoData.withTags(['initial', 'tag']),
        title: 'Modifiable Todo',
      });

      // Check initial stats
      let tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );
      
      expect(tagStats.initial).toBe(1);
      expect(tagStats.tag).toBe(1);

      // Update todo with different tags
      await assert.expectToolCallSuccess('updateTodo', {
        id: todo._id,
        updates: { tags: ['updated', 'tag', 'new'] },
      });

      // Check updated stats
      tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );
      
      expect(tagStats.updated).toBe(1);
      expect(tagStats.tag).toBe(1); // Still present
      expect(tagStats.new).toBe(1);
      expect(tagStats.initial).toBeUndefined(); // Should be removed or 0
    });

    it('should update tag statistics when todos are deleted', async () => {
      // Create todos with tags
      const todo1 = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', {
        ...createTestTodoData.withTags(['delete-test', 'common']),
        title: 'Todo to Delete',
      });
      
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.withTags(['keep-test', 'common']),
        title: 'Todo to Keep',
      });

      // Check initial stats
      let tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );
      
      expect(tagStats['delete-test']).toBe(1);
      expect(tagStats['keep-test']).toBe(1);
      expect(tagStats.common).toBe(2);

      // Delete one todo
      await assert.expectToolCallSuccess('deleteTodo', { id: todo1._id });

      // Check updated stats
      tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );
      
      expect(tagStats['delete-test']).toBeUndefined(); // Should be removed or 0
      expect(tagStats['keep-test']).toBe(1);
      expect(tagStats.common).toBe(1); // Decremented
    });

    it('should handle tag statistics with completion status changes', async () => {
      // Create todo with tags
      const todo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', {
        ...createTestTodoData.withTags(['completion-test']),
        title: 'Completion Test',
      });

      // Check initial stats
      let tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );
      
      expect(tagStats['completion-test']).toBe(1);

      // Complete the todo
      await assert.expectToolCallSuccess('toggleTodoCompletion', { id: todo._id });

      // Tag stats should still include completed todos
      tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );
      
      expect(tagStats['completion-test']).toBe(1);

      // Uncomplete the todo
      await assert.expectToolCallSuccess('toggleTodoCompletion', { id: todo._id });

      // Stats should remain the same
      tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );
      
      expect(tagStats['completion-test']).toBe(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle tag statistics for many todos efficiently', async () => {
      const tagPool = ['urgent', 'project', 'meeting', 'development', 'research', 'testing'];
      
      // Create many todos with random tag combinations
      const todoCount = 50;
      const expectedTagCounts: Record<string, number> = {};
      
      for (let i = 0; i < todoCount; i++) {
        // Select 1-3 random tags
        const numTags = Math.floor(Math.random() * 3) + 1;
        const selectedTags = [];
        
        for (let j = 0; j < numTags; j++) {
          const randomTag = tagPool[Math.floor(Math.random() * tagPool.length)];
          if (!selectedTags.includes(randomTag)) {
            selectedTags.push(randomTag);
          }
        }
        
        // Track expected counts
        for (const tag of selectedTags) {
          expectedTagCounts[tag] = (expectedTagCounts[tag] || 0) + 1;
        }
        
        await assert.expectToolCallSuccess('createTodo', {
          ...createTestTodoData.basic(),
          title: `Performance Test ${i + 1}`,
          tags: selectedTags,
        });
      }

      // Measure performance of tag stats query
      const startTime = Date.now();
      const tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );
      const endTime = Date.now();
      
      // Should complete in reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Verify accuracy of counts
      for (const [tag, expectedCount] of Object.entries(expectedTagCounts)) {
        expect(tagStats[tag]).toBe(expectedCount);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid section requests gracefully', async () => {
      try {
        await assert.expectToolCallSuccess(
          'getServerInfo',
          { section: 'nonexistent-section' }
        );
      } catch (error) {
        // Error is acceptable for invalid section
        expect(error).toBeDefined();
      }
    });

    it('should handle server info requests with no parameters', async () => {
      const serverInfo = await assert.expectToolCallSuccess('getServerInfo', {});
      
      // Should return some form of server information
      expect(serverInfo).toBeDefined();
      expect(typeof serverInfo).toBe('object');
    });
  });

  describe('Real-world Analytics Scenarios', () => {
    it('should provide meaningful analytics for project management', async () => {
      // Create realistic project todos
      const projectTodos = [
        { title: 'Design mockups', tags: ['design', 'urgent', 'project-a'] },
        { title: 'Implement authentication', tags: ['development', 'security', 'project-a'] },
        { title: 'Write unit tests', tags: ['testing', 'development', 'project-a'] },
        { title: 'Client meeting', tags: ['meeting', 'project-a'] },
        { title: 'Code review', tags: ['development', 'review', 'project-b'] },
        { title: 'Deploy to staging', tags: ['deployment', 'project-b', 'urgent'] },
      ];

      for (const todoData of projectTodos) {
        await assert.expectToolCallSuccess('createTodo', {
          ...createTestTodoData.basic(),
          title: todoData.title,
          tags: todoData.tags,
        });
      }

      const tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );

      // Verify project analysis
      expect(tagStats['project-a']).toBe(4);
      expect(tagStats['project-b']).toBe(2);
      expect(tagStats.development).toBe(3);
      expect(tagStats.urgent).toBe(2);
      expect(tagStats.design).toBe(1);
      expect(tagStats.testing).toBe(1);
      expect(tagStats.meeting).toBe(1);
      expect(tagStats.deployment).toBe(1);
    });
  });
});