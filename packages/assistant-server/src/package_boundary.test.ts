import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceDirectory = resolve('packages/assistant-server/src');

interface PackageManifest {
  dependencies: Record<string, string>;
}

describe('assistant server package boundary', () => {
  it('has no imports from channel hosts or sandbox execution', () => {
    const files = readdirSync(sourceDirectory).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );
    for (const file of files) {
      const source = readFileSync(resolve(sourceDirectory, file), 'utf8');
      const imports = [...source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(
        (match) => match[1],
      );
      for (const dependency of imports) {
        expect(dependency, `${file}: ${dependency}`).not.toMatch(
          /telegram.bot|web.api|chat.agent|^\.\.\//,
        );
      }
    }
  });

  it('depends on shared infrastructure rather than a channel application', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(sourceDirectory, '../package.json'), 'utf8'),
    ) as PackageManifest;
    expect(Object.keys(manifest.dependencies)).not.toEqual(
      expect.arrayContaining(['@eddo/telegram-bot']),
    );
    expect(Object.keys(manifest.dependencies)).not.toEqual(
      expect.arrayContaining(['@eddo/web-api']),
    );
  });
});
