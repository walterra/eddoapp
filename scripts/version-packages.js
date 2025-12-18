#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

// Run changeset version
// Git operations (add/commit) are handled by changesets/action
execSync('pnpm changeset version', { stdio: 'inherit' });

// Clean up completed todos in spec/todos/done/
const donePath = 'spec/todos/done';
if (existsSync(donePath)) {
  const doneFiles = readdirSync(donePath).filter((f) => f.endsWith('.md'));
  console.log(`Removing ${doneFiles.length} completed todo(s)...`);
  doneFiles.forEach((file) => {
    const filePath = join(donePath, file);
    unlinkSync(filePath);
    console.log(`  Removed: ${filePath}`);
  });
}
