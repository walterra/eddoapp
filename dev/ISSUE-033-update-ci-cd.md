# ISSUE-012: Update CI/CD Pipeline to Latest GitHub Actions

**Priority:** Medium  
**Category:** DevOps  
**Estimated Effort:** 1 day  
**Impact:** Medium - Improves security and reliability of CI/CD  

## Description

The current CI/CD pipeline uses outdated GitHub Actions that have known security vulnerabilities and deprecated features. Updating to the latest versions will improve security, performance, and reliability of the build process.

## Current Issues

### Outdated Actions
```yaml
# Current .github/workflows/test.yml - OUTDATED
- uses: actions/checkout@v2        # Should be v4
- uses: actions/setup-node@v1      # Should be v4  
- uses: pnpm/action-setup@v2.0.1   # Should be latest
```

### Security Concerns
- **actions/checkout@v2** has known security vulnerabilities
- **actions/setup-node@v1** uses deprecated Node.js setup methods
- Missing security configurations and best practices
- No dependency caching optimization
- No artifact retention policies

### Missing Features
- No performance monitoring in CI
- No bundle size checking
- No security scanning
- No automated dependency updates
- No matrix testing across Node versions

## Implementation Strategy

### 1. Update Core Actions
```yaml
# Updated GitHub Actions workflow
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  actions: read
  checks: write
  pull-requests: write

jobs:
  test:
    name: Test and Build
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          # Only fetch the specific commit to improve performance
          fetch-depth: 1
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml
      
      - name: Setup PNPM
        uses: pnpm/action-setup@v4
        with:
          version: 8
          run_install: false
      
      - name: Get pnpm store directory
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV
      
      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run type check
        run: pnpm tsc:check
      
      - name: Run linting
        run: pnpm lint
      
      - name: Run format check
        run: pnpm lint:format
      
      - name: Run tests
        run: pnpm test
      
      - name: Build application
        run: pnpm build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        if: matrix.node-version == '18.x'
        with:
          name: build-artifacts
          path: dist/
          retention-days: 7
```

### 2. Add Security Scanning
```yaml
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      actions: read
      contents: read
    
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
      
      - name: Run security audit
        run: pnpm audit --audit-level moderate
      
      - name: Run CodeQL analysis
        uses: github/codeql-action/init@v3
        with:
          languages: typescript, javascript
      
      - name: Perform CodeQL analysis
        uses: github/codeql-action/analyze@v3
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
```

### 3. Performance and Quality Checks
```yaml
  quality:
    name: Quality Checks
    runs-on: ubuntu-latest
    needs: test
    
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
      
      - name: Build with bundle analysis
        run: pnpm build:analyze
        env:
          ANALYZE_BUNDLE: true
      
      - name: Check bundle size
        run: |
          BUNDLE_SIZE=$(du -sk dist | cut -f1)
          echo "Bundle size: ${BUNDLE_SIZE}KB"
          echo "BUNDLE_SIZE=${BUNDLE_SIZE}" >> $GITHUB_ENV
          
          # Fail if bundle exceeds 2MB (2048KB)
          if [ $BUNDLE_SIZE -gt 2048 ]; then
            echo "❌ Bundle size (${BUNDLE_SIZE}KB) exceeds limit (2048KB)"
            exit 1
          else
            echo "✅ Bundle size (${BUNDLE_SIZE}KB) is within limit"
          fi
      
      - name: Upload bundle analysis
        uses: actions/upload-artifact@v4
        with:
          name: bundle-analysis
          path: dist/bundle-analysis.html
          retention-days: 30
      
      - name: Comment bundle size on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const bundleSize = process.env.BUNDLE_SIZE;
            const comment = `## Bundle Size Report 📦
            
            **Current bundle size:** ${bundleSize}KB
            **Limit:** 2048KB
            **Status:** ${bundleSize > 2048 ? '❌ Exceeds limit' : '✅ Within limit'}
            
            [View detailed bundle analysis](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

## Acceptance Criteria

- [ ] All GitHub Actions updated to latest stable versions
- [ ] Security scanning integrated into CI/CD pipeline
- [ ] Bundle size monitoring with automatic PR comments
- [ ] Matrix testing across multiple Node.js versions
- [ ] Efficient caching reduces build times
- [ ] Artifact retention policies configured
- [ ] Security vulnerabilities detected and reported
- [ ] Performance regression detection
- [ ] Automated dependency vulnerability scanning

## Implementation Plan

### Step 1: Update Core Workflow (2-3 hours)

1. **Update main test workflow**
   ```bash
   # Backup current workflow
   cp .github/workflows/test.yml .github/workflows/test.yml.backup
   ```

2. **Replace with updated workflow**
   - Update all action versions
   - Add proper permissions
   - Configure caching
   - Add matrix testing

3. **Test updated workflow**
   - Create test PR to verify functionality
   - Check build times and caching effectiveness
   - Verify all steps complete successfully

### Step 2: Add Security and Quality Workflows (2-3 hours)

4. **Create security scanning workflow**
   ```yaml
   # .github/workflows/security.yml
   ```

5. **Create quality checks workflow**
   ```yaml
   # .github/workflows/quality.yml
   ```

6. **Configure secrets and permissions**
   - Add SNYK_TOKEN if using Snyk
   - Configure CodeQL permissions
   - Set up artifact retention policies

### Step 3: Add Advanced Features (2-3 hours)

7. **Add dependabot configuration**
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
       reviewers:
         - "maintainer-username"
       assignees:
         - "maintainer-username"
       commit-message:
         prefix: "deps"
         include: "scope"
     
     - package-ecosystem: "github-actions"
       directory: "/"
       schedule:
         interval: "monthly"
       commit-message:
         prefix: "ci"
   ```

8. **Add PR template**
   ```markdown
   <!-- .github/pull_request_template.md -->
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Testing
   - [ ] Tests pass locally
   - [ ] Added tests for new functionality
   - [ ] Manual testing completed
   
   ## Performance Impact
   - [ ] Bundle size checked
   - [ ] Performance impact assessed
   - [ ] Memory leaks tested
   
   ## Accessibility
   - [ ] Keyboard navigation tested
   - [ ] Screen reader compatibility verified
   - [ ] Color contrast checked
   ```

## Workflow Features

### Enhanced Caching Strategy
```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: |
      ~/.pnpm-store
      node_modules
      dist
    key: ${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-
```

### Conditional Job Execution
```yaml
  deploy:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [test, security, quality]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    # Deployment steps...
```

### Parallel Job Execution
```yaml
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18.x, 20.x]
    runs-on: ${{ matrix.os }}
```

## Performance Improvements

### Before Updates
- Slow checkout and setup
- No dependency caching
- Sequential job execution
- No build optimization

### After Updates
- Fast checkout with fetch-depth: 1
- Efficient PNPM caching
- Parallel job execution
- Optimized artifact handling
- ~50% faster build times expected

## Security Enhancements

### Permissions Hardening
```yaml
permissions:
  contents: read          # Read repository contents
  actions: read          # Read workflow information
  checks: write          # Write check results
  security-events: write # Write security events
  pull-requests: write   # Comment on PRs
```

### Secrets Management
- Use GitHub secrets for sensitive data
- Rotate tokens regularly
- Minimize secret exposure
- Use environment-specific secrets

## Testing Strategy

### Workflow Testing
1. **Create test PR** with workflow changes
2. **Verify all jobs** complete successfully
3. **Check performance** improvements
4. **Test failure scenarios** (failed tests, security issues)
5. **Validate artifacts** are created correctly

### Rollback Plan
1. Keep backup of current workflow
2. Test changes in separate branch
3. Monitor first few runs closely
4. Quick rollback if issues arise

## Dependencies

- Independent of other issues
- Helps with automated testing for other improvements
- Supports quality checks for all future changes

## Definition of Done

- All GitHub Actions updated to latest stable versions
- Security scanning workflow active and passing
- Bundle size monitoring reports on PRs
- Build times improved through better caching
- Matrix testing covers multiple Node.js versions
- Dependabot configured for automatic updates
- PR template guides contributors
- Documentation updated with new workflow features
- All workflows tested and verified working
- Security vulnerabilities detected in CI/CD pipeline