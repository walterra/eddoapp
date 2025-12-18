/**
 * Tests for CouchDB replication functionality
 */

import nano from 'nano';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDatabaseExists } from '../backup-utils.js';
import { replicate } from '../replicate.js';

// Mock dependencies
vi.mock('nano');
vi.mock('../backup-utils.js');
vi.mock('@eddo/core-server/config', () => ({
  validateEnv: vi.fn(() => ({
    COUCHDB_URL: 'http://localhost:5984',
    COUCHDB_USERNAME: 'admin',
    COUCHDB_PASSWORD: 'password',
    COUCHDB_DATABASE: 'eddo-test',
  })),
  getCouchDbConfig: vi.fn(() => ({
    dbName: 'eddo-test',
    url: 'http://admin:password@localhost:5984',
  })),
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
  })),
}));

// Mock console methods
const originalArgv = process.argv;
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('replicate', () => {
  const mockNano = vi.mocked(nano);
  const mockCheckDatabaseExists = vi.mocked(checkDatabaseExists);

  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = [...originalArgv];
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('should replicate from source to target database', async () => {
    // Mock command line arguments
    process.argv = ['node', 'replicate.ts', 'source-db', 'target-db'];

    // Mock database existence checks
    mockCheckDatabaseExists
      .mockResolvedValueOnce({ exists: true, docCount: 10 }) // source
      .mockResolvedValueOnce({ exists: true, docCount: 5 }) // target
      .mockResolvedValueOnce({ exists: true, docCount: 12 }); // final target check

    // Mock nano and replication
    const mockDb = {
      create: vi.fn().mockResolvedValue({}),
      replicate: vi.fn().mockResolvedValue({
        ok: true,
        history: [
          {
            docs_written: 2,
            docs_read: 2,
            missing_checked: 0,
            doc_write_failures: 0,
          },
        ],
      }),
    };

    mockNano.mockReturnValue({ db: mockDb } as unknown as ReturnType<typeof nano>);

    // Mock process.exit to prevent actual exit
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called');
    });

    try {
      await replicate();
    } catch (_error) {
      // Expected if process.exit is called
    }

    expect(mockCheckDatabaseExists).toHaveBeenCalledTimes(3);
    expect(mockDb.replicate).toHaveBeenCalledWith('source-db', 'target-db', {
      create_target: false,
      continuous: false,
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should create target database if it does not exist', async () => {
    // Mock command line arguments
    process.argv = ['node', 'replicate.ts', 'source-db', 'new-target-db'];

    // Mock database existence checks
    mockCheckDatabaseExists
      .mockResolvedValueOnce({ exists: true, docCount: 10 }) // source exists
      .mockResolvedValueOnce({ exists: false, docCount: 0 }) // target does not exist
      .mockResolvedValueOnce({ exists: true, docCount: 10 }); // final target check

    // Mock nano and replication
    const mockDb = {
      create: vi.fn().mockResolvedValue({}),
      replicate: vi.fn().mockResolvedValue({
        ok: true,
        history: [
          {
            docs_written: 10,
            docs_read: 10,
            missing_checked: 0,
            doc_write_failures: 0,
          },
        ],
      }),
    };

    mockNano.mockReturnValue({ db: mockDb } as unknown as ReturnType<typeof nano>);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called');
    });

    try {
      await replicate();
    } catch (_error) {
      // Expected if process.exit is called
    }

    expect(mockDb.create).toHaveBeenCalledWith('new-target-db');
    expect(mockDb.replicate).toHaveBeenCalledWith('source-db', 'new-target-db', {
      create_target: false,
      continuous: false,
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should handle continuous replication', async () => {
    // Mock command line arguments
    process.argv = ['node', 'replicate.ts', 'source-db', 'target-db', '--continuous'];

    // Mock database existence checks
    mockCheckDatabaseExists
      .mockResolvedValueOnce({ exists: true, docCount: 10 })
      .mockResolvedValueOnce({ exists: true, docCount: 5 });

    // Mock nano and replication
    const mockDb = {
      create: vi.fn().mockResolvedValue({}),
      replicate: vi.fn().mockResolvedValue({
        ok: true,
        _id: 'replication-id-123',
        history: [
          {
            docs_written: 2,
            docs_read: 2,
            missing_checked: 0,
            doc_write_failures: 0,
          },
        ],
      }),
    };

    mockNano.mockReturnValue({ db: mockDb } as unknown as ReturnType<typeof nano>);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called');
    });

    try {
      await replicate();
    } catch (_error) {
      // Expected if process.exit is called
    }

    expect(mockDb.replicate).toHaveBeenCalledWith('source-db', 'target-db', {
      create_target: false,
      continuous: true,
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should exit with error if source database does not exist', async () => {
    // Mock command line arguments
    process.argv = ['node', 'replicate.ts', 'nonexistent-db', 'target-db'];

    // Mock database existence check - source does not exist
    mockCheckDatabaseExists.mockResolvedValueOnce({ exists: false, docCount: 0 });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called');
    });

    try {
      await replicate();
    } catch (_error) {
      expect(error.message).toBe('Process exit called');
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with error if required arguments are missing', async () => {
    // Mock command line arguments - missing target
    process.argv = ['node', 'replicate.ts', 'source-db'];

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called');
    });

    try {
      await replicate();
    } catch (_error) {
      expect(error.message).toBe('Process exit called');
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Both source and target database names are required'),
    );
  });

  it('should handle replication errors gracefully', async () => {
    // Mock command line arguments
    process.argv = ['node', 'replicate.ts', 'source-db', 'target-db'];

    // Mock database existence checks
    mockCheckDatabaseExists
      .mockResolvedValueOnce({ exists: true, docCount: 10 })
      .mockResolvedValueOnce({ exists: true, docCount: 5 });

    // Mock nano and replication failure
    const mockDb = {
      create: vi.fn().mockResolvedValue({}),
      replicate: vi.fn().mockResolvedValue({
        ok: false,
        errors: ['Connection failed'],
      }),
    };

    mockNano.mockReturnValue({ db: mockDb } as unknown as ReturnType<typeof nano>);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called');
    });

    try {
      await replicate();
    } catch (_error) {
      // Expected if process.exit is called
    }

    expect(mockDb.replicate).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled(); // Should not exit on replication failure, just show error
  });
});
