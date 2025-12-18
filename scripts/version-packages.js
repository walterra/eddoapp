#!/usr/bin/env node
import { execSync } from 'child_process';

// Run changeset version
// Git operations (add/commit) are handled by changesets/action
execSync('pnpm changeset version', { stdio: 'inherit' });
