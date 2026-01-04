/**
 * Validates changeset files for correct frontmatter format.
 * Ensures double quotes are used (required by @changesets/parse).
 */
import { readFile } from 'fs/promises';

const VALID_BUMP_TYPES = ['patch', 'minor', 'major'];

interface LintResult {
  readonly file: string;
  readonly errors: readonly string[];
}

/**
 * Validates a single changeset file.
 * @param filePath - Path to the changeset file
 * @returns Lint result with any errors found
 */
async function lintChangeset(filePath: string): Promise<LintResult> {
  const errors: string[] = [];
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  // Check opening delimiter
  if (lines[0] !== '---') {
    errors.push('Missing opening frontmatter delimiter (---)');
    return { file: filePath, errors };
  }

  // Find closing delimiter
  const closingIndex = lines.indexOf('---', 1);
  if (closingIndex === -1) {
    errors.push('Missing closing frontmatter delimiter (---)');
    return { file: filePath, errors };
  }

  // Validate frontmatter content
  for (let i = 1; i < closingIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for single quotes (must use double quotes)
    if (line.match(/^'[^']+'/)) {
      errors.push(`Line ${i + 1}: Use double quotes, not single quotes: ${line}`);
    }

    // Validate format: "package-name": bump-type
    const match = line.match(/^"([^"]+)":\s*(\w+)$/);
    if (match) {
      const bumpType = match[2];
      if (!VALID_BUMP_TYPES.includes(bumpType)) {
        errors.push(
          `Line ${i + 1}: Invalid bump type "${bumpType}". Use: ${VALID_BUMP_TYPES.join(', ')}`,
        );
      }
    } else if (!line.match(/^['"]?[^'"]+['"]?:\s*\w+$/)) {
      errors.push(`Line ${i + 1}: Invalid frontmatter format: ${line}`);
    }
  }

  // Check for content after frontmatter
  const contentAfterFrontmatter = lines
    .slice(closingIndex + 1)
    .join('\n')
    .trim();
  if (!contentAfterFrontmatter) {
    errors.push('Missing changeset description after frontmatter');
  }

  return { file: filePath, errors };
}

async function main(): Promise<void> {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.log('No changeset files to lint');
    process.exit(0);
  }

  let hasErrors = false;

  for (const file of files) {
    const result = await lintChangeset(file);
    if (result.errors.length > 0) {
      hasErrors = true;
      console.error(`\n${result.file}:`);
      for (const error of result.errors) {
        console.error(`  ✗ ${error}`);
      }
    }
  }

  if (hasErrors) {
    console.error('\nChangeset validation failed');
    process.exit(1);
  }

  console.log(`✓ ${files.length} changeset(s) validated`);
}

main();
