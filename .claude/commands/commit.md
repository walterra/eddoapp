git commit just the currently staged files with a proper one-liner commit message. it must be a one-liner without any credit information like "generated with" or "co-authored by".

IMPORTANT: Before committing, record the list of originally staged files using `git diff --cached --name-only`. This is critical for the next step.

Note: Husky pre-commit hook runs TypeScript checks, linting, and format checks. If the hook finds problems:
1. Fix the issues (formatting, linting, etc.)
2. ONLY stage files that were in the ORIGINAL staged files list
3. Do NOT stage any files that were modified by formatters/linters but weren't originally staged
4. If a formatter modified an unstaged file, leave it unstaged
5. NEVER use `git add .` or bulk staging commands

Example: If only A.ts was originally staged, but the formatter also modified B.ts (which was unstaged), only stage A.ts for the commit. Leave B.ts unstaged.
