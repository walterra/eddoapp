#!/usr/bin/env node
/**
 * Creates or updates a release PR with eddo-app-only changelog.
 * Replaces changesets/action for full control over PR body content.
 *
 * Environment variables:
 * - GITHUB_TOKEN: Required for GitHub API calls
 * - GITHUB_REPOSITORY: owner/repo format (set by GitHub Actions)
 */
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ROOT_CHANGELOG = 'CHANGELOG.md';
const CHANGESETS_DIR = '.changeset';
const BASE_BRANCH = 'main';
const RELEASE_BRANCH = `changeset-release/${BASE_BRANCH}`;

/**
 * Executes a command and returns stdout
 * @param {string} cmd - Command to execute
 * @param {object} options - execSync options
 * @returns {string} stdout output
 */
function exec(cmd, options = {}) {
  return execSync(cmd, { encoding: 'utf-8', ...options }).trim();
}

/**
 * Executes a command with inherited stdio
 * @param {string} cmd - Command to execute
 */
function execInherit(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

/**
 * Checks if there are pending changesets
 * @returns {boolean} True if changesets exist
 */
function hasPendingChangesets() {
  if (!existsSync(CHANGESETS_DIR)) return false;
  const files = readdirSync(CHANGESETS_DIR);
  return files.some((f) => f.endsWith('.md') && f !== 'README.md');
}

/**
 * Gets pending changeset count
 * @returns {number} Number of pending changesets
 */
function getChangesetCount() {
  if (!existsSync(CHANGESETS_DIR)) return 0;
  const files = readdirSync(CHANGESETS_DIR);
  return files.filter((f) => f.endsWith('.md') && f !== 'README.md').length;
}

/**
 * Gets version from package.json
 * @returns {string} Current version
 */
function getVersion() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  return pkg.version;
}

/**
 * Extracts latest version entry from CHANGELOG.md
 * @param {string} version - Version to extract
 * @returns {string|null} Changelog content for version
 */
function extractChangelog(version) {
  if (!existsSync(ROOT_CHANGELOG)) return null;

  const changelog = readFileSync(ROOT_CHANGELOG, 'utf-8');
  const lines = changelog.split('\n');
  const versionHeader = `## ${version}`;
  const startIdx = lines.findIndex((line) => line.startsWith(versionHeader));

  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.startsWith('## ') ||
      line.startsWith('---') ||
      line.startsWith('# ') ||
      line.startsWith('All notable changes')
    ) {
      endIdx = i;
      break;
    }
  }

  return lines
    .slice(startIdx + 1, endIdx)
    .join('\n')
    .trim();
}

/**
 * Cleans up completed todos
 */
function cleanupDoneTodos() {
  const donePath = 'spec/todos/done';
  if (!existsSync(donePath)) return;

  const doneFiles = readdirSync(donePath).filter((f) => f.endsWith('.md'));
  if (doneFiles.length === 0) return;

  console.log(`Removing ${doneFiles.length} completed todo(s)...`);
  doneFiles.forEach((file) => {
    const filePath = join(donePath, file);
    unlinkSync(filePath);
    console.log(`  Removed: ${filePath}`);
  });
}

/**
 * Generates PR body with only eddo-app changelog
 * @param {string} version - Release version
 * @param {string} changelog - Changelog content
 * @returns {string} PR body markdown
 */
function generatePrBody(version, changelog) {
  const header = `This PR was opened by the release workflow. When you're ready to do a release, merge this PR.

If you're not ready yet, any new changesets added to \`${BASE_BRANCH}\` will update this PR.

`;

  const releases = `# Releases

## eddo-app@${version}

${changelog || 'No changelog entries found.'}
`;

  return header + releases;
}

/**
 * Creates or updates the release PR
 * @param {string} title - PR title
 * @param {string} body - PR body
 * @returns {number} PR number
 */
function createOrUpdatePr(title, body) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    throw new Error('GITHUB_REPOSITORY environment variable not set');
  }

  // Write body to temp file to avoid escaping issues
  const bodyFile = join(tmpdir(), 'pr-body.md');
  writeFileSync(bodyFile, body);

  // Check for existing PR
  const existingPr = exec(
    `gh pr list --repo ${repo} --head ${RELEASE_BRANCH} --base ${BASE_BRANCH} --json number --jq '.[0].number' 2>/dev/null || echo ''`,
  );

  if (existingPr) {
    console.log(`Updating existing PR #${existingPr}...`);
    execInherit(
      `gh pr edit ${existingPr} --repo ${repo} --title "${title}" --body-file "${bodyFile}"`,
    );
    return parseInt(existingPr, 10);
  }

  console.log('Creating new PR...');
  const prUrl = exec(
    `gh pr create --repo ${repo} --head ${RELEASE_BRANCH} --base ${BASE_BRANCH} --title "${title}" --body-file "${bodyFile}"`,
  );
  const prNumber = prUrl.split('/').pop();
  console.log(`Created PR #${prNumber}: ${prUrl}`);
  return parseInt(prNumber, 10);
}

/** Configure git user for commits */
function setupGitUser() {
  exec('git config user.name "github-actions[bot]"');
  exec('git config user.email "github-actions[bot]@users.noreply.github.com"');
}

/** Prepare or reset release branch */
function prepareReleaseBranch() {
  console.log(`Preparing branch: ${RELEASE_BRANCH}`);
  try {
    exec(`git fetch origin ${RELEASE_BRANCH}:${RELEASE_BRANCH} 2>/dev/null || true`);
    exec(`git checkout ${RELEASE_BRANCH} 2>/dev/null || git checkout -b ${RELEASE_BRANCH}`);
    exec(`git fetch origin ${BASE_BRANCH}`);
    exec(`git reset --hard origin/${BASE_BRANCH}`);
  } catch {
    exec(`git checkout -b ${RELEASE_BRANCH}`);
  }
}

/** Commit and push changes, returns false if no changes */
function commitAndPush() {
  const status = exec('git status --porcelain');
  if (!status) {
    console.log('No changes to commit.');
    return false;
  }
  console.log('\nCommitting changes...');
  execInherit('git add .');
  exec('git commit -m "chore: version packages"');
  console.log(`\nPushing to ${RELEASE_BRANCH}...`);
  execInherit(`git push origin ${RELEASE_BRANCH} --force`);
  return true;
}

/** Main entry point */
async function main() {
  console.log('=== Release PR Creation ===\n');
  if (!hasPendingChangesets()) {
    console.log('No pending changesets found. Nothing to do.');
    return;
  }
  console.log(`Found ${getChangesetCount()} pending changeset(s)\n`);

  setupGitUser();
  prepareReleaseBranch();

  console.log('\nRunning changeset version...');
  execInherit('pnpm changeset version');
  cleanupDoneTodos();

  const version = getVersion();
  console.log(`\nVersion: ${version}`);

  if (!commitAndPush()) return;

  const prNumber = createOrUpdatePr(
    `release v${version}`,
    generatePrBody(version, extractChangelog(version)),
  );
  console.log(`\nPR #${prNumber} ready for review`);
  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
