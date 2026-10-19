import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';

/** Returns archive names and checks their metadata sidecars. */
export function listBackupArchives(directory: string, prefix = ''): string[] {
  const archives = fs
    .readdirSync(directory)
    .filter(
      (file) =>
        file.startsWith(prefix) && file.endsWith('.json') && !file.endsWith('.metadata.json'),
    );
  for (const archive of archives) {
    expect(fs.existsSync(path.join(directory, `${archive}.metadata.json`))).toBe(true);
  }
  return archives;
}
