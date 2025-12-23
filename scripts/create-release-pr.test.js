import { describe, expect, it } from 'vitest';

/**
 * Extracts latest version entry from a changelog string.
 * Extracted for testing from create-release-pr.js
 * @param {string} changelog - Full changelog content
 * @param {string} version - Version to extract
 * @returns {string|null} Changelog content for version
 */
function extractChangelog(changelog, version) {
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
 * Generates PR body with only eddo-app changelog.
 * Extracted for testing from create-release-pr.js
 * @param {string} version - Release version
 * @param {string} changelog - Changelog content
 * @returns {string} PR body markdown
 */
function generatePrBody(version, changelog) {
  const header = `This PR was opened by the release workflow. When you're ready to do a release, merge this PR.

If you're not ready yet, any new changesets added to \`main\` will update this PR.

`;

  const releases = `# Releases

## eddo-app@${version}

${changelog || 'No changelog entries found.'}
`;

  return header + releases;
}

describe('create-release-pr', () => {
  describe('extractChangelog', () => {
    it('extracts changelog for specific version', () => {
      const changelog = `# Changelog

## 0.3.0

### Minor Changes

- Add feature A
- Add feature B

### Patch Changes

- Fix bug C

## 0.2.0

### Minor Changes

- Old feature
`;

      const result = extractChangelog(changelog, '0.3.0');

      expect(result).toBe(`### Minor Changes

- Add feature A
- Add feature B

### Patch Changes

- Fix bug C`);
    });

    it('returns null if version not found', () => {
      const changelog = `# Changelog

## 0.2.0

### Minor Changes

- Some feature
`;

      const result = extractChangelog(changelog, '0.3.0');

      expect(result).toBeNull();
    });

    it('stops at horizontal rule', () => {
      const changelog = `# Changelog

## 0.3.0

### Minor Changes

- Feature

---

Old content
`;

      const result = extractChangelog(changelog, '0.3.0');

      expect(result).toBe(`### Minor Changes

- Feature`);
    });

    it('stops at "All notable changes" marker', () => {
      const changelog = `# Changelog

## 0.1.0

### Minor Changes

- Initial release

All notable changes to this project will be documented in this file.
`;

      const result = extractChangelog(changelog, '0.1.0');

      expect(result).toBe(`### Minor Changes

- Initial release`);
    });

    it('handles empty changelog section', () => {
      const changelog = `# Changelog

## 0.3.0

## 0.2.0

### Minor Changes

- Feature
`;

      const result = extractChangelog(changelog, '0.3.0');

      expect(result).toBe('');
    });
  });

  describe('generatePrBody', () => {
    it('generates PR body with changelog', () => {
      const result = generatePrBody('0.3.0', '### Minor Changes\n\n- Add feature');

      expect(result).toContain('This PR was opened by the release workflow');
      expect(result).toContain('## eddo-app@0.3.0');
      expect(result).toContain('### Minor Changes');
      expect(result).toContain('- Add feature');
    });

    it('handles null changelog', () => {
      const result = generatePrBody('0.3.0', null);

      expect(result).toContain('## eddo-app@0.3.0');
      expect(result).toContain('No changelog entries found.');
    });

    it('does not include other packages', () => {
      const result = generatePrBody('0.3.0', '### Minor Changes\n\n- Feature');

      expect(result).not.toContain('@eddo/web-client');
      expect(result).not.toContain('@eddo/core-shared');
      expect(result).not.toContain('Updated dependencies');
    });
  });
});
