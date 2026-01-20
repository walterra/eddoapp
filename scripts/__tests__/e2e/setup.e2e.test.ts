/**
 * Setup Wizard E2E Tests (Tier 2 - Full Docker Integration)
 *
 * Tests the setup wizard's output and behavior.
 * Requires Docker to be running on the host.
 *
 * NOTE: These tests focus on verifiable output patterns rather than
 * exit codes, since the setup wizard may fail on developer machines
 * due to pre-existing state (existing pi-coding-agent skills, etc.)
 */

import { execSync } from 'child_process';
import { runner } from 'clet';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

/**
 * Check if Docker daemon is running
 */
function isDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a service is healthy
 */
function isServiceHealthy(url: string): boolean {
  try {
    execSync(`curl -sf ${url}`, { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if running in CI environment (clean state)
 */
function isCI(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

describe('Setup Wizard E2E', () => {
  let testEnvDir: string;
  let originalEnvPath: string;
  let envBackupPath: string | null = null;

  beforeAll(() => {
    if (!isDockerRunning()) {
      console.log('⚠️  Skipping setup E2E tests: Docker daemon not running');
    }
  });

  beforeEach(() => {
    testEnvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-e2e-'));
    originalEnvPath = path.join(PROJECT_ROOT, '.env');
    if (fs.existsSync(originalEnvPath)) {
      envBackupPath = path.join(testEnvDir, '.env.backup');
      fs.copyFileSync(originalEnvPath, envBackupPath);
    }
  });

  afterEach(() => {
    if (envBackupPath && fs.existsSync(envBackupPath)) {
      fs.copyFileSync(envBackupPath, originalEnvPath);
    }
    if (fs.existsSync(testEnvDir)) {
      fs.rmSync(testEnvDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Leave services running for development
  });

  describe('doctor command', () => {
    it.skipIf(!isDockerRunning())(
      'validates environment diagnostics output',
      async () => {
        // Ensure services are running
        if (!isServiceHealthy('http://localhost:5984/_up')) {
          execSync('docker compose up -d couchdb elasticsearch', {
            cwd: PROJECT_ROOT,
            stdio: 'pipe',
          });
          await new Promise((resolve) => setTimeout(resolve, 15000));
        }

        // Run doctor and verify it produces diagnostic output
        // Note: In CI, doctor may report warnings/failures for things like
        // port conflicts or missing optional services, so we don't assert exit code
        const result = execSync('pnpm dev:doctor 2>&1 || true', {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
        });

        // Verify diagnostic sections are present
        expect(result).toMatch(/Eddo Doctor/);
        expect(result).toMatch(/Prerequisites/);
        expect(result).toMatch(/Docker Services/);
        expect(result).toMatch(/CouchDB/);
      },
      120000,
    );
  });

  describe('.env file generation', () => {
    it.skipIf(!isDockerRunning())(
      'generates .env with correct defaults when file does not exist',
      async () => {
        // Remove existing .env
        if (fs.existsSync(originalEnvPath)) {
          fs.unlinkSync(originalEnvPath);
        }

        // Run setup and capture result - allow any exit code
        const result = execSync('pnpm dev:setup --ci 2>&1 || true', {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
        });

        // Verify output contains env generation message
        expect(result).toContain('Generated .env file');

        // Verify .env was created with expected content
        expect(fs.existsSync(originalEnvPath)).toBe(true);
        const envContent = fs.readFileSync(originalEnvPath, 'utf-8');
        expect(envContent).toContain('COUCHDB_URL');
        expect(envContent).toContain('NODE_ENV=development');
      },
      120000,
    );

    it.skipIf(!isDockerRunning())(
      'does not overwrite existing .env without --force',
      async () => {
        // Create a custom .env
        const customContent = 'CUSTOM_VAR=test123\nCOUCHDB_URL=http://custom:5984\n';
        fs.writeFileSync(originalEnvPath, customContent);

        // Run setup
        execSync('pnpm dev:setup --ci 2>&1 || true', {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
        });

        // Verify .env was not overwritten
        const envContent = fs.readFileSync(originalEnvPath, 'utf-8');
        expect(envContent).toContain('CUSTOM_VAR=test123');
      },
      120000,
    );

    it.skipIf(!isDockerRunning())(
      'overwrites .env with --force flag',
      async () => {
        // Create a custom .env
        fs.writeFileSync(originalEnvPath, 'CUSTOM_VAR=test123\n');

        // Run setup with force
        const result = execSync('pnpm dev:setup --ci --force 2>&1 || true', {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
        });

        // Verify output shows generation
        expect(result).toContain('Generated .env file');

        // Verify .env was overwritten
        const envContent = fs.readFileSync(originalEnvPath, 'utf-8');
        expect(envContent).toContain('COUCHDB_URL');
        expect(envContent).not.toContain('CUSTOM_VAR');
      },
      120000,
    );
  });

  describe('prerequisite detection', () => {
    it.skipIf(!isDockerRunning())(
      'detects installed prerequisites',
      async () => {
        const result = execSync('pnpm dev:setup --ci 2>&1 || true', {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
        });

        // Verify prerequisites are detected
        expect(result).toMatch(/Node\.js.*installed/);
        expect(result).toMatch(/pnpm.*installed/);
        expect(result).toMatch(/Docker.*installed/);
        expect(result).toMatch(/Git.*installed/);
      },
      120000,
    );
  });

  // CI-only test for complete flow
  describe('CI mode (full flow)', () => {
    it.skipIf(!isDockerRunning() || !isCI())(
      'runs complete setup successfully in clean CI environment',
      async () => {
        await runner()
          .cwd(PROJECT_ROOT)
          .spawn('pnpm', ['dev:setup', '--ci'])
          .stdout(/Eddo Development Setup/)
          .stdout(/Checking prerequisites/)
          .stdout(/Docker services started|CouchDB: running/)
          .code(0);

        // Verify services are healthy
        await new Promise((resolve) => setTimeout(resolve, 5000));
        expect(isServiceHealthy('http://localhost:5984/_up')).toBe(true);
      },
      300000,
    );
  });
});
