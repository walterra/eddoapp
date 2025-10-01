#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Run changeset version
execSync('pnpm changeset version', { stdio: 'inherit' });

// Read the package.json to get the new version
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const version = packageJson.version;

// Stage and commit with conventional commit format
execSync('git add .', { stdio: 'inherit' });
execSync(`git commit -m "chore: release v${version}"`, { stdio: 'inherit' });
