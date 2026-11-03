import { auditNoZod } from './no_zod_policy.js';

try {
  const diagnostics = await auditNoZod(process.cwd());
  for (const diagnostic of diagnostics) {
    console.error(`${diagnostic.file}:${diagnostic.line}: no-zod: ${diagnostic.message}`);
  }
  process.exitCode = diagnostics.length ? 1 : 0;
  if (!diagnostics.length)
    console.log('no-zod: pass (direct imports and dependencies; transitive dependencies excluded)');
} catch (error) {
  console.error('no-zod: audit failed', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
