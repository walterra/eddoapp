// @vitest-environment node
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface ApiPackageMetadata {
  type?: string;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
}
const root = resolve('.');
const apiRoot = join(root, 'packages/web-api');
const metadata = JSON.parse(
  readFileSync(join(apiRoot, 'package.json'), 'utf8'),
) as ApiPackageMetadata;
interface ApiCompilerOptions {
  module: string;
}
interface ApiTypeScriptConfig {
  compilerOptions: ApiCompilerOptions;
}
const compiler = (
  JSON.parse(readFileSync(join(apiRoot, 'tsconfig.json'), 'utf8')) as ApiTypeScriptConfig
).compilerOptions;
const require = createRequire(join(apiRoot, 'package.json'));
let directory: string;
let fixtureConfig: string;

/** Loads real validation code without importing the listening server or requiring workspace builds. */
function run(args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, NODE_ENV: 'test', NODE_OPTIONS: '', TSX_TSCONFIG_PATH: fixtureConfig },
  });
}

/** Omits bundled loader source from diagnostics so source-map parsers only receive stack lines. */
function failureDetails(result: SpawnSyncReturns<string>): string {
  return (
    result.error?.message ??
    result.stderr
      .split('\n')
      .filter((line) => line.length < 300 && !line.includes('sourceMappingURL'))
      .join('\n')
  );
}

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'eddo-api-module-'));
  fixtureConfig = join(directory, 'tsconfig.json');
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: metadata.type }));
  writeFileSync(
    fixtureConfig,
    JSON.stringify({
      extends: join(apiRoot, 'tsconfig.json'),
      compilerOptions: {
        baseUrl: root,
        paths: { '@eddo/core-shared/*': [join(root, 'packages/core-shared/src/*')] },
      },
    }),
  );
  const source = pathToFileURL(join(apiRoot, 'src/routes/auth_schemas.ts')).href;
  writeFileSync(join(directory, 'auth_schemas.js'), `export { registerSchema } from '${source}';`);
  writeFileSync(
    join(directory, 'probe.js'),
    `import { registerSchema } from './auth_schemas';
     const value = registerSchema.parse({ username: 'user', email: 'user@example.com', password: 'password' });
     if (value.rememberMe !== false) throw new Error('missing default');
     console.log('validation loaded');`,
  );
});
afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('web API ESM validation loading', () => {
  it('declares ESM and keeps its production loader available without development dependencies', () => {
    expect(metadata.type).toBe('module');
    expect(compiler.module).toBe('ESNext');
    expect(metadata.dependencies.tsx).toBeTruthy();
    expect(metadata.scripts.start).toContain('node --import tsx');
    expect(metadata.scripts['start:otel']).toContain('--import tsx');
  });

  it('loads the actual source schemas through the development tsx CLI', () => {
    const result = run([
      require.resolve('tsx/cli'),
      '--tsconfig',
      fixtureConfig,
      join(apiRoot, 'src/routes/auth_schemas.ts'),
    ]);
    expect(result.status, failureDetails(result)).toBe(0);
  });

  it('loads JavaScript entries and extensionless imports through the production loader', () => {
    const result = run(['--import', 'tsx', join(directory, 'probe.js')]);
    expect(result.status, failureDetails(result)).toBe(0);
    expect(result.stdout).toContain('validation loaded');
  });
});
