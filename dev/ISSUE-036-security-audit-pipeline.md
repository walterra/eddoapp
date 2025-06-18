# ISSUE-015: Add Security Audit to CI/CD Pipeline

**Priority:** Medium  
**Category:** Security  
**Estimated Effort:** 1-2 days  
**Impact:** High - Prevents security vulnerabilities in production  

## Description

The CI/CD pipeline currently lacks automated security scanning, leaving the application vulnerable to security issues that could be detected before deployment. A comprehensive security audit pipeline is essential for maintaining security standards.

## Current Security Gaps

### Missing Security Checks
- No dependency vulnerability scanning
- No static code analysis for security issues
- No secrets detection in codebase
- No license compliance checking
- No security policy enforcement
- No automated penetration testing

### Security Risks
- Vulnerable dependencies may be deployed
- Security anti-patterns could go undetected
- Secrets might be accidentally committed
- License violations could create legal issues
- Security regressions not caught early

## Implementation Strategy

### 1. Multi-Layer Security Scanning
```yaml
# .github/workflows/security-audit.yml
name: Security Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Run weekly security scans
    - cron: '0 2 * * 1'

permissions:
  contents: read
  security-events: write
  actions: read
  pull-requests: write

jobs:
  dependency-scan:
    name: Dependency Vulnerability Scan
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
      
      - name: Run npm audit
        run: |
          pnpm audit --audit-level moderate --json > audit-results.json || true
          
      - name: Process audit results
        run: |
          if [ -s audit-results.json ]; then
            echo "Security vulnerabilities found:"
            cat audit-results.json | jq '.vulnerabilities'
            
            HIGH_COUNT=$(cat audit-results.json | jq '.metadata.vulnerabilities.high // 0')
            CRITICAL_COUNT=$(cat audit-results.json | jq '.metadata.vulnerabilities.critical // 0')
            
            echo "HIGH_VULNERABILITIES=$HIGH_COUNT" >> $GITHUB_ENV
            echo "CRITICAL_VULNERABILITIES=$CRITICAL_COUNT" >> $GITHUB_ENV
            
            if [ "$CRITICAL_COUNT" -gt 0 ]; then
              echo "❌ Critical vulnerabilities found: $CRITICAL_COUNT"
              exit 1
            elif [ "$HIGH_COUNT" -gt 0 ]; then
              echo "⚠️ High vulnerabilities found: $HIGH_COUNT"
              exit 1
            fi
          fi
      
      - name: Upload audit results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-audit-results
          path: audit-results.json
          retention-days: 30

  snyk-scan:
    name: Snyk Security Scan
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
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --json > snyk-results.json
      
      - name: Upload Snyk results to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: snyk.sarif

  codeql-analysis:
    name: CodeQL Security Analysis
    runs-on: ubuntu-latest
    
    permissions:
      actions: read
      contents: read
      security-events: write
    
    strategy:
      matrix:
        language: ['typescript', 'javascript']
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: security-extended,security-and-quality
      
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
      
      - name: Build application
        run: pnpm build
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"

  secrets-scan:
    name: Secrets Detection
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Run TruffleHog OSS
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified

  license-scan:
    name: License Compliance Check
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
      
      - name: Install license checker
        run: pnpm add -D license-checker
      
      - name: Check licenses
        run: |
          npx license-checker --json > licenses.json
          
          # Check for forbidden licenses
          FORBIDDEN_LICENSES="GPL-2.0,GPL-3.0,AGPL-1.0,AGPL-3.0"
          
          if npx license-checker --excludePrivatePackages --failOn "$FORBIDDEN_LICENSES"; then
            echo "✅ No forbidden licenses found"
          else
            echo "❌ Forbidden licenses detected"
            exit 1
          fi
      
      - name: Upload license report
        uses: actions/upload-artifact@v4
        with:
          name: license-report
          path: licenses.json

  security-summary:
    name: Security Summary
    runs-on: ubuntu-latest
    needs: [dependency-scan, snyk-scan, codeql-analysis, secrets-scan, license-scan]
    if: always()
    
    steps:
      - name: Create security summary
        run: |
          echo "## Security Audit Summary 🔒" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Check | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| Dependency Scan | ${{ needs.dependency-scan.result == 'success' && '✅ Passed' || '❌ Failed' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Snyk Scan | ${{ needs.snyk-scan.result == 'success' && '✅ Passed' || '❌ Failed' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| CodeQL Analysis | ${{ needs.codeql-analysis.result == 'success' && '✅ Passed' || '❌ Failed' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Secrets Detection | ${{ needs.secrets-scan.result == 'success' && '✅ Passed' || '❌ Failed' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| License Compliance | ${{ needs.license-scan.result == 'success' && '✅ Passed' || '❌ Failed' }} |" >> $GITHUB_STEP_SUMMARY
```

### 2. Security Policy Configuration
```yaml
# .github/SECURITY.md
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by emailing [security@example.com](mailto:security@example.com).

**Please do not report security vulnerabilities through public GitHub issues.**

### What to Include

- A description of the vulnerability
- Steps to reproduce the issue
- Possible impact of the vulnerability
- Any suggested fixes or mitigations

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 1 week
- **Resolution**: Within 30 days (for critical issues)

## Security Best Practices

### For Contributors

- Run `pnpm audit` before submitting PRs
- Never commit secrets or API keys
- Use environment variables for sensitive configuration
- Follow secure coding practices
- Keep dependencies up to date

### For Deployments

- Use HTTPS in production
- Set proper Content Security Policy headers
- Enable security headers (HSTS, X-Frame-Options, etc.)
- Regular security updates
- Monitor for vulnerabilities
```

### 3. Automated Vulnerability Fixes
```yaml
# .github/workflows/auto-security-updates.yml
name: Auto Security Updates

on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  security-updates:
    name: Automated Security Updates
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      
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
      
      - name: Check for security updates
        run: |
          pnpm audit --fix --audit-level moderate
          
          # Check if any changes were made
          if ! git diff --quiet pnpm-lock.yaml; then
            echo "SECURITY_UPDATES=true" >> $GITHUB_ENV
          else
            echo "SECURITY_UPDATES=false" >> $GITHUB_ENV
          fi
      
      - name: Create Pull Request
        if: env.SECURITY_UPDATES == 'true'
        uses: peter-evans/create-pull-request@v5
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'fix(deps): automated security updates'
          title: 'Automated Security Updates'
          body: |
            ## Automated Security Updates 🔒
            
            This PR contains automated security updates for vulnerable dependencies.
            
            ### Changes
            - Updated dependencies with security vulnerabilities
            - Fixed vulnerabilities found by `pnpm audit`
            
            ### Verification
            - [ ] All tests pass
            - [ ] Security scan passes
            - [ ] Application functionality verified
            
            **Auto-generated by GitHub Actions**
          branch: automated-security-updates
          delete-branch: true
```

## Acceptance Criteria

- [ ] Dependency vulnerability scanning integrated into CI/CD
- [ ] Static code analysis detects security issues
- [ ] Secrets detection prevents accidental commits
- [ ] License compliance checking enforced
- [ ] Security scan results reported in PRs
- [ ] Automated security updates create PRs
- [ ] Security policy documented and accessible
- [ ] Critical vulnerabilities block deployments

## Implementation Plan

### Phase 1: Basic Security Scanning (Day 1)

1. **Set up dependency scanning**
   - Configure npm audit in CI/CD
   - Add Snyk integration
   - Set vulnerability thresholds

2. **Add CodeQL analysis**
   - Configure GitHub CodeQL
   - Set up security-focused queries
   - Enable SARIF upload

3. **Implement secrets detection**
   - Add TruffleHog or similar tool
   - Configure patterns for common secrets
   - Block commits with detected secrets

### Phase 2: Advanced Security Features (Day 1-2)

4. **Add license compliance**
   - Install license checker
   - Define allowed/forbidden licenses
   - Generate license reports

5. **Create security policy**
   - Document vulnerability reporting process
   - Define supported versions
   - Set response timelines

6. **Configure automated updates**
   - Set up dependabot or manual automation
   - Create automated PR workflow
   - Define update policies

### Phase 3: Integration and Monitoring (Day 2)

7. **Integrate with PR workflow**
   - Add security check requirements
   - Configure PR comments with results
   - Set up status checks

8. **Add security monitoring**
   - Configure alerting for security issues
   - Set up regular security scans
   - Monitor security metrics

## Security Tools Configuration

### Snyk Configuration
```json
// .snyk
{
  "version": "v1.0.0",
  "ignore": {},
  "patch": {},
  "language-settings": {
    "javascript": {
      "ignoreDevDependencies": false
    }
  }
}
```

### CodeQL Configuration
```yaml
# .github/codeql/codeql-config.yml
name: "Security CodeQL Config"

queries:
  - name: security-extended
    uses: security-extended
  - name: security-and-quality
    uses: security-and-quality

paths-ignore:
  - node_modules
  - dist
  - coverage
  - '**/*.test.ts'
  - '**/*.test.tsx'
```

### License Checker Configuration
```json
// package.json
{
  "scripts": {
    "license-check": "license-checker --excludePrivatePackages --failOn 'GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0'",
    "license-report": "license-checker --json --out licenses.json"
  }
}
```

## Security Thresholds

### Vulnerability Severity Thresholds
- **Critical**: Block deployment immediately
- **High**: Block deployment, require manual review
- **Medium**: Generate warning, allow deployment
- **Low**: Log for tracking, allow deployment

### Response Times
- **Critical vulnerabilities**: 24 hours
- **High vulnerabilities**: 72 hours
- **Medium vulnerabilities**: 1 week
- **Low vulnerabilities**: Next release cycle

## Integration with Development Workflow

### Pre-commit Hooks
```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run security checks before commit
pnpm audit --audit-level moderate
pnpm run lint:security
```

### PR Requirements
```yaml
# .github/branch-protection-rules.yml
required_status_checks:
  - "Security Audit / Dependency Vulnerability Scan"
  - "Security Audit / CodeQL Security Analysis"
  - "Security Audit / Secrets Detection"
  - "Security Audit / License Compliance Check"
```

## Monitoring and Reporting

### Security Dashboard
```typescript
// src/components/SecurityDashboard.tsx (admin only)
interface SecurityMetrics {
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastScan: string;
  complianceScore: number;
}

function SecurityDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);

  // Load security metrics for admin users
  // Display vulnerability trends, compliance status, etc.
}
```

## Dependencies

- Works with ISSUE-012 (CI/CD updates) for pipeline integration
- Complements ISSUE-005 (CSP) for comprehensive security
- Benefits from all other security-related improvements

## Definition of Done

- Dependency vulnerability scanning active in CI/CD pipeline
- Static code analysis detects and reports security issues
- Secrets detection prevents accidental exposure
- License compliance enforced and reported
- Security scan results visible in PRs and security tab
- Automated security updates configured
- Security policy documented and accessible
- Critical vulnerabilities block deployments
- Security metrics tracked and monitored
- Team trained on security workflow and response procedures