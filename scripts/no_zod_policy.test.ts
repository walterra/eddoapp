import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditNoZod, manifestDiagnostics, sourceDiagnostics } from './no_zod_policy';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'eddo-no-zod-'));
  directories.push(root);
  await mkdir(join(root, 'packages', 'example'), { recursive: true });
  await mkdir(join(root, 'scripts'));
  await writeFile(join(root, 'package.json'), '{}');
  return root;
}

describe('direct Zod regression policy', () => {
  it.each([
    'import { z } from "zod";',
    'import type { ZodType } from "zod/v4";',
    'type Schema = import("zod").ZodType;',
    'export { z } from "zod";',
    'const schema = require("zod/mini");',
    'const schema = await import("zod");',
    'import schema = require("zod");',
    'const schema = import(\x60zod\x60);',
  ])('rejects maintained direct module references: %s', (source) => {
    expect(sourceDiagnostics('source.ts', source)).toHaveLength(1);
  });

  it('does not match comments or fixture strings', () => {
    expect(
      sourceDiagnostics(
        'source.ts',
        '// import { z } from "zod";\nconst fixture = \'import { z } from "zod";\';',
      ),
    ).toEqual([]);
    expect(
      sourceDiagnostics('source.ts', 'import { compile } from "@earendil-works/pi-schema";'),
    ).toEqual([]);
  });

  it.each(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'])(
    'rejects direct manifest entries in %s',
    (group) => {
      expect(
        manifestDiagnostics('package.json', JSON.stringify({ [group]: { zod: '^4' } })),
      ).toHaveLength(1);
    },
  );

  it('rejects npm aliases without matching unrelated package names', () => {
    expect(
      manifestDiagnostics(
        'package.json',
        JSON.stringify({ dependencies: { schema: 'npm:zod@4' } }),
      ),
    ).toHaveLength(1);
    expect(
      manifestDiagnostics(
        'package.json',
        JSON.stringify({ dependencies: { schema: 'npm:other@4' } }),
      ),
    ).toEqual([]);
  });

  it('fails closed on malformed manifests', () => {
    expect(() => manifestDiagnostics('package.json', 'invalid')).toThrow();
    expect(() => manifestDiagnostics('package.json', 'null')).toThrow();
  });

  it('audits packages and scripts while excluding generated output and dependencies', async () => {
    const root = await fixture();
    await writeFile(join(root, 'packages', 'example', 'schema.ts'), 'import { z } from "zod";');
    await writeFile(join(root, 'scripts', 'schema.mjs'), 'const z = await import("zod");');
    await mkdir(join(root, 'packages', 'example', 'node_modules'));
    await writeFile(
      join(root, 'packages', 'example', 'node_modules', 'package.json'),
      '{"dependencies":{"zod":"4"}}',
    );
    await mkdir(join(root, 'packages', 'example', 'dist'));
    await writeFile(join(root, 'packages', 'example', 'dist', 'schema.js'), 'import "zod";');
    const diagnostics = await auditNoZod(root);
    expect(diagnostics.map((issue) => issue.file).sort()).toEqual([
      'packages/example/schema.ts',
      'scripts/schema.mjs',
    ]);
  });
});
