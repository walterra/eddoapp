# Development Workflow

## Making Changes

1. **Feature Branches**:
   - Create a branch for your feature or bugfix
   - Use descriptive branch names, e.g., `feature/add-calendar-view` or `fix/time-tracking-bug`

2. **Code Organization**:
   - Place new components in the `src/components` directory
   - Add utility functions to `src/utils`
   - New types should go in `src/types`
   - When adding new data fields, consider if a schema migration is needed (see `src/api/versions`)

3. **Component Development**:
   - Follow React functional component patterns
   - Use TypeScript for type safety
   - Use Tailwind CSS for styling

## Testing

1. **Running Tests**:
   ```bash
   # Run all tests
   pnpm test
   
   # Run a specific test file
   pnpm vitest:run src/path/to/file.test.ts
   ```

2. **Writing Tests**:
   - Place test files alongside implementation files with `.test.ts` or `.test.tsx` extension
   - Use Vitest's `describe`/`it` pattern
   - Follow the existing test patterns as seen in the utils tests
   - Test utilities and business logic thoroughly

3. **TypeScript Checking**:
   ```bash
   pnpm tsc:check
   ```

## Code Style

1. **Formatting**:
   ```bash
   # Check formatting
   pnpm lint:format
   
   # Fix formatting issues
   pnpm format
   ```

2. **Linting**:
   ```bash
   # Run ESLint
   pnpm lint
   ```

3. **Style Guidelines**:
   - Use snake_case for filenames
   - Use camelCase for variables/functions, PascalCase for components/types
   - Use single quotes and trailing commas
   - Use explicit return types for functions
   - Follow the existing import sorting (managed by @trivago/prettier-plugin-sort-imports)
   - Use TailwindCSS for styling
   - Use try/catch with console.error for error handling