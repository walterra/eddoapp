import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadRecordings } from './files.js';

const directories: string[] = [];
const path = 'packages/telegram_bot/src/integration-tests/cassettes/test/scenario.json';

function cassette(title: string): string {
  return JSON.stringify({
    testName: title,
    interactions: [
      {
        request: {
          model: 'test/model',
          messages: [{ role: 'user', content: JSON.stringify({ role: 'user', content: title }) }],
        },
        response: JSON.stringify({
          format: 'pi-durable-assistant-v1',
          message: { role: 'assistant', content: [{ type: 'text', text: title }] },
        }),
      },
    ],
  });
}

function directory(): string {
  const root = mkdtempSync(join(tmpdir(), 'eddo-review-'));
  directories.push(root);
  mkdirSync(dirname(join(root, path)), { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('recording selection', () => {
  it('reads staged blobs instead of later working-tree edits', () => {
    const root = directory();
    execFileSync('git', ['init', '-q'], { cwd: root });
    writeFileSync(join(root, path), cassette('staged'));
    execFileSync('git', ['add', path], { cwd: root });
    writeFileSync(join(root, path), cassette('working tree'));
    expect(loadRecordings(root, true)[0].scenarioId).toBe('staged');
    expect(loadRecordings(root, false)[0].scenarioId).toBe('working tree');
  });

  it('rejects invalid inputs before review starts', () => {
    const root = directory();
    writeFileSync(join(root, path), '{}');
    expect(() => loadRecordings(root, false)).toThrow();
  });
});
