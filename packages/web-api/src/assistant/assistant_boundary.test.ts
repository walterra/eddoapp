import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('assistant API execution boundary', () => {
  it('never imports a journal runtime or channel owner', () => {
    const directory = resolve('packages/web-api/src/assistant');
    for (const name of readdirSync(directory).filter(
      (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
    )) {
      const source = readFileSync(resolve(directory, name), 'utf8');
      expect(source, name).not.toMatch(
        /@eddo\/assistant-server|@earendil-works\/pi-durable|telegram_bot|_pi_durable_/,
      );
    }
  });
});
