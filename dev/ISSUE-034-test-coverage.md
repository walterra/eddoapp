# ISSUE-013: Add Test Coverage Reporting with Minimum Thresholds

**Priority:** Medium  
**Category:** Testing  
**Estimated Effort:** 1 day  
**Impact:** Medium - Ensures code quality and test completeness  

## Description

The project currently lacks test coverage reporting and minimum coverage thresholds. This makes it difficult to assess the completeness of the test suite and prevent regression in test coverage as the codebase grows.

## Current State

### Missing Coverage Features
- No test coverage reports generated
- No minimum coverage thresholds enforced
- No coverage tracking in CI/CD pipeline
- No visual coverage reports
- No coverage badges or metrics

### Current Testing Gaps
- Only utility functions have tests (limited coverage)
- Zero component test coverage
- No integration test coverage
- Unknown overall coverage percentage

## Implementation Strategy

### 1. Configure Vitest Coverage
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8', // or 'c8'
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      
      // Coverage thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Per-file thresholds
        'src/components/': {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75
        },
        'src/utils/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      
      // Include/exclude patterns
      include: [
        'src/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test-setup.ts',
        'src/types/',
        'src/**/*.d.ts',
        'src/constants.ts',
        'node_modules/',
        'dist/'
      ],
      
      // Fail build if coverage is below threshold
      skipFull: false,
      all: true
    }
  }
});
```

### 2. Coverage Reporting Scripts
```json
// package.json updates
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:coverage:watch": "vitest --coverage --watch",
    "test:coverage:ui": "vitest --coverage --ui",
    "coverage:open": "open coverage/index.html"
  }
}
```

## Acceptance Criteria

- [ ] Test coverage reports generated in multiple formats
- [ ] Minimum coverage thresholds enforced (80% overall)
- [ ] Coverage reports integrated into CI/CD pipeline
- [ ] Visual HTML coverage reports accessible
- [ ] Coverage trends tracked over time
- [ ] PR comments show coverage changes
- [ ] Coverage badges available for README
- [ ] Per-directory coverage thresholds configured

## Implementation Plan

### Step 1: Configure Coverage Reporting (2-3 hours)

1. **Update Vitest configuration**
   ```bash
   # Install coverage dependencies if needed
   pnpm add -D @vitest/coverage-v8
   ```

2. **Create test setup file**
   ```typescript
   // src/test-setup.ts
   import '@testing-library/jest-dom';
   import { beforeAll, afterEach } from 'vitest';
   import { cleanup } from '@testing-library/react';

   // Mock PouchDB for tests
   beforeAll(() => {
     global.indexedDB = {
       // Mock IndexedDB for PouchDB tests
     } as any;
   });

   // Cleanup after each test
   afterEach(() => {
     cleanup();
   });
   ```

3. **Configure coverage thresholds**
   ```typescript
   // Gradual coverage improvement strategy
   const coverageThresholds = {
     // Start with achievable thresholds
     global: {
       branches: 60,    // Gradually increase to 80%
       functions: 65,   // Gradually increase to 80%
       lines: 70,       // Gradually increase to 80%
       statements: 70   // Gradually increase to 80%
     },
     
     // Higher standards for utilities (already tested)
     'src/utils/': {
       branches: 85,
       functions: 90,
       lines: 90,
       statements: 90
     }
   };
   ```

### Step 2: CI/CD Integration (2-3 hours)

4. **Update GitHub Actions workflow**
   ```yaml
   # .github/workflows/coverage.yml
   name: Test Coverage

   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]

   jobs:
     coverage:
       name: Test Coverage Report
       runs-on: ubuntu-latest
       
       steps:
         - name: Checkout code
           uses: actions/checkout@v4
         
         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: '18'
             cache: 'pnpm'
         
         - name: Setup PNPM
           uses: pnpm/action-setup@v4
           with:
             version: 8
         
         - name: Install dependencies
           run: pnpm install --frozen-lockfile
         
         - name: Run tests with coverage
           run: pnpm test:coverage
         
         - name: Upload coverage to Codecov
           uses: codecov/codecov-action@v4
           with:
             token: ${{ secrets.CODECOV_TOKEN }}
             files: ./coverage/lcov.info
             flags: unittests
             name: codecov-umbrella
             fail_ci_if_error: true
         
         - name: Generate coverage report comment
           uses: 5monkeys/cobertura-action@master
           if: github.event_name == 'pull_request'
           with:
             path: coverage/cobertura-coverage.xml
             repo_token: ${{ secrets.GITHUB_TOKEN }}
             minimum_coverage: 70
             show_missing: true
         
         - name: Upload coverage reports
           uses: actions/upload-artifact@v4
           with:
             name: coverage-reports
             path: coverage/
             retention-days: 30
   ```

5. **Add coverage comment on PRs**
   ```yaml
   - name: Comment coverage on PR
     if: github.event_name == 'pull_request'
     uses: actions/github-script@v7
     with:
       script: |
         const fs = require('fs');
         const path = './coverage/coverage-summary.json';
         
         if (fs.existsSync(path)) {
           const coverage = JSON.parse(fs.readFileSync(path, 'utf8'));
           const { lines, statements, branches, functions } = coverage.total;
           
           const comment = `## Coverage Report 📊
           
           | Metric | Coverage | Threshold | Status |
           |--------|----------|-----------|--------|
           | Lines | ${lines.pct}% | 70% | ${lines.pct >= 70 ? '✅' : '❌'} |
           | Statements | ${statements.pct}% | 70% | ${statements.pct >= 70 ? '✅' : '❌'} |
           | Branches | ${branches.pct}% | 60% | ${branches.pct >= 60 ? '✅' : '❌'} |
           | Functions | ${functions.pct}% | 65% | ${functions.pct >= 65 ? '✅' : '❌'} |
           
           [View detailed coverage report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})`;
           
           github.rest.issues.createComment({
             issue_number: context.issue.number,
             owner: context.repo.owner,
             repo: context.repo.repo,
             body: comment
           });
         }
   ```

### Step 3: Coverage Monitoring and Visualization (2-3 hours)

6. **Add coverage badge to README**
   ```markdown
   <!-- README.md -->
   # Eddo - GTD Todo & Time Tracking

   [![Test Coverage](https://codecov.io/gh/username/eddoapp/branch/main/graph/badge.svg)](https://codecov.io/gh/username/eddoapp)
   [![Build Status](https://github.com/username/eddoapp/workflows/CI/badge.svg)](https://github.com/username/eddoapp/actions)

   ## Coverage Reports
   
   - [Latest Coverage Report](https://codecov.io/gh/username/eddoapp)
   - [Local Coverage Report](./coverage/index.html) (after running `pnpm test:coverage`)
   ```

7. **Create coverage monitoring dashboard**
   ```typescript
   // src/dev/CoverageDashboard.tsx (development only)
   interface CoverageData {
     lines: { pct: number; covered: number; total: number };
     statements: { pct: number; covered: number; total: number };
     branches: { pct: number; covered: number; total: number };
     functions: { pct: number; covered: number; total: number };
   }

   function CoverageDashboard() {
     const [coverage, setCoverage] = useState<CoverageData | null>(null);

     useEffect(() => {
       // Load coverage data in development
       if (process.env.NODE_ENV === 'development') {
         fetch('/coverage/coverage-summary.json')
           .then(res => res.json())
           .then(data => setCoverage(data.total))
           .catch(() => console.log('No coverage data available'));
       }
     }, []);

     if (process.env.NODE_ENV !== 'development' || !coverage) {
       return null;
     }

     return (
       <div className="coverage-dashboard">
         <h3>Test Coverage</h3>
         <div className="coverage-metrics">
           {Object.entries(coverage).map(([key, value]) => (
             <div key={key} className="coverage-metric">
               <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
               <div className="coverage-bar">
                 <div 
                   className={`coverage-fill ${value.pct >= 80 ? 'high' : value.pct >= 60 ? 'medium' : 'low'}`}
                   style={{ width: `${value.pct}%` }}
                 />
                 <span>{value.pct}% ({value.covered}/{value.total})</span>
               </div>
             </div>
           ))}
         </div>
       </div>
     );
   }
   ```

## Coverage Thresholds Strategy

### Gradual Improvement Plan
```typescript
// Month 1 - Baseline (current state)
const initialThresholds = {
  global: { lines: 40, statements: 40, branches: 30, functions: 45 }
};

// Month 2 - After component tests added
const phase1Thresholds = {
  global: { lines: 60, statements: 60, branches: 50, functions: 65 }
};

// Month 3 - Full coverage target
const targetThresholds = {
  global: { lines: 80, statements: 80, branches: 70, functions: 80 }
};
```

### Per-Directory Thresholds
```typescript
const directoryThresholds = {
  // High-value utilities should have high coverage
  'src/utils/': { lines: 90, statements: 90, branches: 85, functions: 90 },
  
  // Core components should have good coverage
  'src/components/': { lines: 75, statements: 75, branches: 65, functions: 80 },
  
  // API layer should be well tested
  'src/api/': { lines: 85, statements: 85, branches: 75, functions: 85 },
  
  // Types and constants don't need coverage
  'src/types/': { lines: 0, statements: 0, branches: 0, functions: 0 }
};
```

## Uncovered Code Analysis

### Identifying Coverage Gaps
```bash
# Generate detailed coverage report
pnpm test:coverage

# Open HTML report to identify uncovered lines
pnpm coverage:open

# Find files with low coverage
pnpm vitest run --coverage --reporter=verbose | grep -E "^\s*[0-5][0-9]\%"
```

### Coverage Hotspots
- **Error handling paths:** Often uncovered, need specific tests
- **Edge cases:** Boundary conditions and unusual inputs
- **Async operations:** Promise rejections and timeouts
- **User interactions:** Click handlers and form submissions

## Coverage Quality Guidelines

### What to Test
✅ **High Value:**
- Business logic and calculations
- Data transformation functions
- Error handling paths
- User interaction flows
- API integration points

### What Not to Over-Test
❌ **Low Value:**
- Type definitions
- Constants and configuration
- Simple getters/setters
- Third-party library wrappers

## Testing Strategy Integration

### Coverage-Driven Development
1. **Write tests first** for new features
2. **Check coverage** before committing
3. **Aim for meaningful tests**, not just coverage percentage
4. **Review uncovered code** in code reviews
5. **Track coverage trends** over time

### Coverage in Code Reviews
```markdown
## Code Review Checklist

### Testing
- [ ] New code has corresponding tests
- [ ] Coverage doesn't decrease below thresholds
- [ ] Tests cover edge cases and error paths
- [ ] Integration tests added for new features
```

## Dependencies

- Depends on ISSUE-003 (component tests) for meaningful coverage numbers
- Works with ISSUE-012 (CI/CD updates) for automated reporting
- Supports all other development workflow improvements

## Definition of Done

- Test coverage reporting configured with multiple output formats
- Minimum coverage thresholds enforced in CI/CD pipeline
- Coverage reports generated and uploaded for every PR
- PR comments show coverage changes and threshold compliance
- HTML coverage reports accessible for detailed analysis
- Coverage badges added to README
- Coverage trends tracked over time
- Per-directory thresholds configured appropriately
- Documentation updated with coverage standards and workflows
- Development team trained on coverage interpretation and improvement