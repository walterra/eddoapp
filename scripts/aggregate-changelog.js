#!/usr/bin/env node
/**
 * Extracts root package changelog for GitHub releases.
 * Outputs only the latest version from CHANGELOG.md to reduce noise.
 */
import { existsSync, readFileSync } from 'fs';

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
 * Outputs only the root package changelog for the current version.
 * Individual package changelogs are skipped to reduce noise.
 */
function aggregateChangelogs() {
  const version = getCurrentVersion();

  // Only include root changelog
  if (existsSync(ROOT_CHANGELOG)) {
    const rootChangelog = readFileSync(ROOT_CHANGELOG, 'utf-8');
    const rootEntry = extractLatestVersion(rootChangelog, version);
    if (rootEntry) {
      return `# Release v${version}\n\n${rootEntry}`;
    }
  }

  return `# Release v${version}\n\nNo changelog entries found.`;
}

// Output the aggregated changelog
console.log(aggregateChangelogs());
