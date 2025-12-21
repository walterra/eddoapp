#!/usr/bin/env node
/**
 * Aggregates changelog entries from all packages for GitHub releases.
 * Reads the latest version from each package CHANGELOG.md and combines them.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const PACKAGES_DIR = 'packages';
const ROOT_CHANGELOG = 'CHANGELOG.md';

/**
 * Extracts the latest version entry from a changelog
 */
function extractLatestVersion(changelog, version) {
  const lines = changelog.split('\n');
  const versionHeader = `## ${version}`;
  const startIdx = lines.findIndex((line) => line.startsWith(versionHeader));

  if (startIdx === -1) return null;

  // Find the next version header, horizontal rule, or end marker
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at next version, horizontal rule, or common changelog section markers
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
 * Gets the current version from root package.json
 */
function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  return pkg.version;
}

/**
 * Aggregates all package changelogs for the current version.
 * With fixed versioning, all packages share the same version.
 */
function aggregateChangelogs() {
  const version = getCurrentVersion();
  const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort();

  const aggregated = [`# Release v${version}\n`];
  const sections = [];

  // Add root changelog
  if (existsSync(ROOT_CHANGELOG)) {
    const rootChangelog = readFileSync(ROOT_CHANGELOG, 'utf-8');
    const rootEntry = extractLatestVersion(rootChangelog, version);
    if (rootEntry) {
      sections.push(`## Root Package\n\n${rootEntry}`);
    }
  }

  // Add package changelogs
  for (const pkg of packages) {
    const changelogPath = join(PACKAGES_DIR, pkg, 'CHANGELOG.md');
    if (!existsSync(changelogPath)) continue;

    const changelog = readFileSync(changelogPath, 'utf-8');
    const entry = extractLatestVersion(changelog, version);

    if (entry) {
      sections.push(`## ${pkg}\n\n${entry}`);
    }
  }

  if (sections.length === 0) {
    return `# Release v${version}\n\nNo changelog entries found.`;
  }

  return aggregated[0] + '\n' + sections.join('\n\n---\n\n');
}

// Output the aggregated changelog
console.log(aggregateChangelogs());
