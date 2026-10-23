import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readRecording } from './recording.js';
import type { Recording } from './schema.js';

const CASSETTES = 'packages/telegram_bot/src/integration-tests/cassettes';

function jsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(path);
    return entry.isFile() && entry.name.endsWith('.json') ? [path] : [];
  });
}

/** Reads staged blobs or working-tree recordings before any paid calls. */
export function loadRecordings(root: string, staged: boolean): Recording[] {
  const paths = staged
    ? execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
        cwd: root,
        encoding: 'utf8',
      })
        .split('\0')
        .filter((path) => path.startsWith(`${CASSETTES}/`) && path.endsWith('.json'))
    : jsonFiles(join(root, CASSETTES)).map((path) => relative(root, path));
  return paths.sort().map((path) => {
    const text = staged
      ? execFileSync('git', ['show', `:${path}`], {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 10_000_000,
        })
      : readFileSync(join(root, path), 'utf8');
    const recording = readRecording(path, text);
    if (JSON.stringify(recording).length > 500_000) throw new Error(`Recording too large: ${path}`);
    return recording;
  });
}
