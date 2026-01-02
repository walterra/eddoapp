/**
 * Test Lock Mechanism
 * Ensures true sequential execution of integration tests
 */
import { getRandomHex } from '@eddo/core-shared';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const LOCK_FILE = join(tmpdir(), 'eddo-integration-test.lock');
const LOCK_TIMEOUT = 60000; // 60 seconds max wait
const STALE_LOCK_AGE = 30000; // 30 seconds

/** Check if error is EEXIST (file already exists) */
function isFileExistsError(error: unknown): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === 'EEXIST';
}

/** Check and handle stale lock, returns true if should retry */
async function handleStaleLock(testId: string): Promise<'retry' | 'wait'> {
  try {
    const lockContent = await fs.readFile(LOCK_FILE, 'utf8');
    const lockStats = await fs.stat(LOCK_FILE);
    const lockAge = Date.now() - lockStats.mtime.getTime();

    if (lockAge > STALE_LOCK_AGE) {
      console.warn(`⚠️  [${testId}] Removing stale lock (${lockAge}ms old)`);
      await fs.unlink(LOCK_FILE);
      return 'retry';
    }

    console.log(`⏳ [${testId}] Waiting for lock held by: ${lockContent}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return 'wait';
  } catch {
    // Lock file disappeared, retry
    return 'retry';
  }
}

export class TestLock {
  private lockAcquired = false;
  private readonly testId: string;

  constructor() {
    // Generate unique test ID
    this.testId = `test-${Date.now()}-${getRandomHex(9)}`;
  }

  async acquire(): Promise<void> {
    console.log(`🔒 [${this.testId}] Acquiring test lock...`);

    const startTime = Date.now();

    while (Date.now() - startTime < LOCK_TIMEOUT) {
      try {
        await fs.writeFile(LOCK_FILE, this.testId, { flag: 'wx' });
        this.lockAcquired = true;
        console.log(`✅ [${this.testId}] Test lock acquired`);
        return;
      } catch (error: unknown) {
        if (!isFileExistsError(error)) throw error;
        await handleStaleLock(this.testId);
      }
    }

    throw new Error(`Failed to acquire test lock within ${LOCK_TIMEOUT}ms`);
  }

  async release(): Promise<void> {
    if (!this.lockAcquired) {
      return;
    }

    try {
      // Verify we still own the lock
      const lockContent = await fs.readFile(LOCK_FILE, 'utf8');
      if (lockContent === this.testId) {
        await fs.unlink(LOCK_FILE);
        console.log(`🔓 [${this.testId}] Test lock released`);
      } else {
        console.warn(`⚠️  [${this.testId}] Lock ownership changed, not releasing`);
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        console.error(`❌ [${this.testId}] Failed to release lock:`, error);
      }
    }

    this.lockAcquired = false;
  }
}
