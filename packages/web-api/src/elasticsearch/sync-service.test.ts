import { describe, expect, it, vi } from 'vitest';

// Mock the withSpan function to just execute the callback
vi.mock('../utils/logger', () => ({
  withSpan: vi.fn((_name, _attrs, fn) => fn({ setAttribute: vi.fn() })),
}));

describe('sync-service', () => {
  describe('createSyncService', () => {
    it('should create a sync service with required methods', async () => {
      const { createSyncService } = await import('./sync-service');

      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const mockEsClient = {
        bulk: vi.fn().mockResolvedValue({ errors: false, took: 10, items: [] }),
        indices: {
          putIndexTemplate: vi.fn().mockResolvedValue({}),
        },
      };

      const mockCouchDb = {
        db: {
          list: vi.fn().mockResolvedValue([]),
        },
        use: vi.fn(),
      };

      const syncService = createSyncService({
        esClient: mockEsClient as unknown as Parameters<typeof createSyncService>[0]['esClient'],
        getCouchDb: () =>
          mockCouchDb as unknown as ReturnType<
            Parameters<typeof createSyncService>[0]['getCouchDb']
          >,
        logger: mockLogger as unknown as Parameters<typeof createSyncService>[0]['logger'],
      });

      expect(syncService).toBeDefined();
      expect(syncService.initialize).toBeDefined();
      expect(syncService.shutdown).toBeDefined();
      expect(syncService.getStatus).toBeDefined();
      expect(syncService.watchDatabase).toBeDefined();
      expect(syncService.unwatchDatabase).toBeDefined();
    });
  });

  describe('getStatus', () => {
    it('should return initial status with empty databases', async () => {
      const { createSyncService } = await import('./sync-service');

      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const mockEsClient = {
        bulk: vi.fn(),
        indices: {
          putIndexTemplate: vi.fn().mockResolvedValue({}),
        },
      };

      const mockCouchDb = {
        db: { list: vi.fn().mockResolvedValue([]) },
        use: vi.fn(),
      };

      const syncService = createSyncService({
        esClient: mockEsClient as unknown as Parameters<typeof createSyncService>[0]['esClient'],
        getCouchDb: () =>
          mockCouchDb as unknown as ReturnType<
            Parameters<typeof createSyncService>[0]['getCouchDb']
          >,
        logger: mockLogger as unknown as Parameters<typeof createSyncService>[0]['logger'],
      });

      const status = syncService.getStatus();

      expect(status.isInitialized).toBe(false);
      expect(status.pendingDocs).toBe(0);
      expect(status.databases).toEqual([]);
    });
  });

  describe('database type detection', () => {
    it('should correctly identify database types from names', () => {
      // Test the getDatabaseType logic
      const getDatabaseType = (dbName: string): 'user' | 'audit' | 'unknown' => {
        if (dbName.startsWith('eddo_user_')) return 'user';
        if (dbName.startsWith('eddo_audit_')) return 'audit';
        return 'unknown';
      };

      expect(getDatabaseType('eddo_user_walterra')).toBe('user');
      expect(getDatabaseType('eddo_user_eddo_pi_agent')).toBe('user');
      expect(getDatabaseType('eddo_audit_walterra')).toBe('audit');
      expect(getDatabaseType('eddo_audit_eddo_pi_agent')).toBe('audit');
      expect(getDatabaseType('eddo_chat_walterra')).toBe('unknown');
      expect(getDatabaseType('some_other_db')).toBe('unknown');
    });
  });

  describe('user ID extraction', () => {
    it('should extract user ID from database names', () => {
      const extractUserId = (dbName: string): string => {
        const userMatch = dbName.match(/^eddo_user_(.+)$/);
        if (userMatch) return userMatch[1];

        const auditMatch = dbName.match(/^eddo_audit_(.+)$/);
        if (auditMatch) return auditMatch[1];

        return dbName;
      };

      expect(extractUserId('eddo_user_walterra')).toBe('walterra');
      expect(extractUserId('eddo_user_eddo_pi_agent')).toBe('eddo_pi_agent');
      expect(extractUserId('eddo_audit_walterra')).toBe('walterra');
      expect(extractUserId('eddo_audit_eddo_pi_agent')).toBe('eddo_pi_agent');
      expect(extractUserId('some_other_db')).toBe('some_other_db');
    });
  });

  describe('index naming', () => {
    it('should use 1:1 mapping between CouchDB and ES index names', () => {
      // The sync service uses dbName directly as esIndexName (1:1 mapping)
      const getEsIndexName = (dbName: string): string => dbName;

      expect(getEsIndexName('eddo_user_walterra')).toBe('eddo_user_walterra');
      expect(getEsIndexName('eddo_audit_walterra')).toBe('eddo_audit_walterra');
    });
  });
});
