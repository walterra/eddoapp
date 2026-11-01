// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createInteractionRecord,
  createNewCassette,
  getCassettePath,
  saveCassetteToFile,
} from './cassette-helpers.js';
import { createCassetteManager } from './cassette-manager.js';

const directories: string[] = [];

function directory(): string {
  const path = mkdtempSync(join(tmpdir(), 'cassette-formatting-'));
  directories.push(path);
  return path;
}

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('cassette formatting', () => {
  it('writes repository-formatted JSON without changing hashes or embedded payloads', async () => {
    const cassette = createNewCassette('formatting');
    cassette.interactions.push(
      createInteractionRecord({
        requestHash: 'original-hash',
        model: 'scripted/model',
        systemPrompt: 'System instructions',
        messages: [{ role: 'user', content: 'Preserve whitespace:  a\n b' }],
        response: JSON.stringify({ text: 'Unicode € and spaces  stay unchanged', values: [1, 2] }),
        responseTimeMs: 1,
      }),
    );
    const original = structuredClone(cassette);
    const path = join(directory(), 'nested', 'cassette.json');
    await saveCassetteToFile(path, cassette);
    const written = readFileSync(path, 'utf8');
    const config = await resolveConfig(import.meta.filename);
    expect(config?.printWidth).toBe(100);
    expect(written).toBe(await format(JSON.stringify(cassette), { ...config, filepath: path }));
    expect(written.endsWith('\n')).toBe(true);
    expect(JSON.parse(written)).toEqual(original);
    expect(cassette).toEqual(original);
  });

  it.each(['record', 'auto'] as const)(
    'awaits formatted saves when switching and ejecting in %s mode',
    async (mode) => {
      const cassettesDir = directory();
      const manager = createCassetteManager({ cassettesDir, mode, namespace: 'scripted' });
      await manager.loadCassette('first');
      await manager.handleInteraction('scripted/model', 'Prompt', [], async () => 'First response');
      await manager.loadCassette('second');
      const first = getCassettePath({ cassettesDir, namespace: 'scripted', testName: 'first' });
      expect(readFileSync(first, 'utf8').endsWith('\n')).toBe(true);
      await manager.handleInteraction(
        'scripted/model',
        'Prompt',
        [],
        async () => 'Second response',
      );
      await manager.ejectCassette();
      const second = getCassettePath({ cassettesDir, namespace: 'scripted', testName: 'second' });
      expect(readFileSync(second, 'utf8').endsWith('\n')).toBe(true);
      const replay = createCassetteManager({
        cassettesDir,
        mode: 'playback',
        namespace: 'scripted',
      });
      await replay.loadCassette('second');
      expect(
        await replay.handleInteraction('scripted/model', 'Prompt', [], async () => {
          throw new Error('Playback cannot call the provider');
        }),
      ).toBe('Second response');
      replay.assertConsumed();
      const before = readFileSync(second, 'utf8');
      await replay.ejectCassette();
      expect(readFileSync(second, 'utf8')).toBe(before);
    },
  );
});
