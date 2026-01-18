import { describe, expect, it, vi } from 'vitest';

import { createIndexManager } from './index-manager';

describe('index-manager', () => {
  describe('createIndexManager', () => {
    it('should create an index manager with required methods', () => {
      const mockClient = {
        indices: {
          exists: vi.fn(),
          create: vi.fn(),
          delete: vi.fn(),
          putIndexTemplate: vi.fn(),
          getMapping: vi.fn(),
          stats: vi.fn(),
          refresh: vi.fn(),
        },
        count: vi.fn(),
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );

      expect(manager.indexExists).toBeDefined();
      expect(manager.createTodoTemplate).toBeDefined();
      expect(manager.createAuditTemplate).toBeDefined();
      expect(manager.getIndicesHealth).toBeDefined();
      expect(manager.deleteIndex).toBeDefined();
      expect(manager.deleteIndicesByPattern).toBeDefined();
      expect(manager.refreshIndices).toBeDefined();
      expect(manager.getMapping).toBeDefined();
      expect(manager.initialize).toBeDefined();
    });
  });

  describe('indexExists', () => {
    it('should return true when index exists', async () => {
      const mockClient = {
        indices: {
          exists: vi.fn().mockResolvedValue(true),
        },
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );
      const result = await manager.indexExists('eddo_user_walterra');

      expect(result).toBe(true);
      expect(mockClient.indices.exists).toHaveBeenCalledWith({ index: 'eddo_user_walterra' });
    });

    it('should return false when index does not exist', async () => {
      const mockClient = {
        indices: {
          exists: vi.fn().mockResolvedValue(false),
        },
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );
      const result = await manager.indexExists('eddo_user_nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('createTodoTemplate', () => {
    it('should create todo index template', async () => {
      const mockClient = {
        indices: {
          putIndexTemplate: vi.fn().mockResolvedValue({}),
        },
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );
      const result = await manager.createTodoTemplate();

      expect(result.success).toBe(true);
      expect(result.message).toContain('eddo_user_template');
      expect(mockClient.indices.putIndexTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'eddo_user_template',
          index_patterns: ['eddo_user_*'],
        }),
      );
    });
  });

  describe('createAuditTemplate', () => {
    it('should create audit index template', async () => {
      const mockClient = {
        indices: {
          putIndexTemplate: vi.fn().mockResolvedValue({}),
        },
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );
      const result = await manager.createAuditTemplate();

      expect(result.success).toBe(true);
      expect(result.message).toContain('eddo_audit_template');
      expect(mockClient.indices.putIndexTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'eddo_audit_template',
          index_patterns: ['eddo_audit_*'],
        }),
      );
    });
  });

  describe('initialize', () => {
    it('should create both templates', async () => {
      const mockClient = {
        indices: {
          putIndexTemplate: vi.fn().mockResolvedValue({}),
        },
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );
      const result = await manager.initialize();

      expect(result.success).toBe(true);
      expect(mockClient.indices.putIndexTemplate).toHaveBeenCalledTimes(2);
    });
  });

  describe('getIndicesHealth', () => {
    it('should return health info for matching indices', async () => {
      const mockClient = {
        indices: {
          stats: vi.fn().mockResolvedValue({
            indices: {
              eddo_user_walterra: {},
              eddo_user_test: {},
            },
          }),
        },
        count: vi.fn().mockResolvedValue({ count: 1000 }),
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );
      const result = await manager.getIndicesHealth('eddo_user_*');

      expect(result.success).toBe(true);
      expect(result.details?.indices).toHaveLength(2);
      expect(result.details?.totalDocuments).toBe(1000);
    });

    it('should handle no matching indices gracefully', async () => {
      const mockClient = {
        indices: {
          stats: vi.fn().mockRejectedValue({ meta: { statusCode: 404 } }),
        },
        count: vi.fn(),
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );
      const result = await manager.getIndicesHealth('nonexistent_*');

      expect(result.success).toBe(true);
      expect(result.details?.indices).toEqual([]);
      expect(result.details?.totalDocuments).toBe(0);
    });
  });

  describe('deleteIndex', () => {
    it('should delete existing index', async () => {
      const mockClient = {
        indices: {
          exists: vi.fn().mockResolvedValue(true),
          delete: vi.fn().mockResolvedValue({}),
        },
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );
      const result = await manager.deleteIndex('eddo_user_test');

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted');
      expect(mockClient.indices.delete).toHaveBeenCalledWith({ index: 'eddo_user_test' });
    });

    it('should handle non-existent index', async () => {
      const mockClient = {
        indices: {
          exists: vi.fn().mockResolvedValue(false),
        },
      };

      const manager = createIndexManager(
        mockClient as unknown as Parameters<typeof createIndexManager>[0],
      );
      const result = await manager.deleteIndex('eddo_user_nonexistent');

      expect(result.success).toBe(true);
      expect(result.message).toContain('does not exist');
    });
  });
});
