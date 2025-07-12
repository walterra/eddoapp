push this branch to github and create a PR. the PR description must not contain any information like "generated with" or "co-authored by".

IMPORTANT: Before creating the PR, check for unstaged changes using `git status`. 

If there are unstaged changes:
1. **DO NOT automatically stage unstaged files** - ask the user what to do with them
2. The user may want to commit them, discard them, or leave them unstaged
3. NEVER use `git add .` or bulk staging commands without explicit user consent
4. Only proceed with PR creation after addressing unstaged changes appropriately

If committing unstaged changes is needed, follow the commit command guidelines:
1. Use proper linting scripts (`pnpm lint`, `pnpm format`, `pnpm tsc:check`) before manual fixes
2. Only stage files that were intended to be staged
3. Be mindful of pre-commit hooks that may modify additional files
