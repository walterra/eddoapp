# CLI Testing Best Practices

Research and best practices for creating end-to-end tests for interactive Node.js CLI scripts.

## Overview

This document outlines best practices for testing interactive command-line interfaces, particularly for our backup/restore scripts. The focus is on testing CLI applications the way users actually interact with them.

## Key Libraries & Tools

### CLET (Command Line E2E Testing)
Purpose-built library for CLI testing with chainable API:

```javascript
await runner()
  .cwd(targetDir)
  .spawn('node', ['backup-interactive.js'])
  .stdin(/Database URL:/, 'http://localhost:5984/mydb')
  .stdin(/Backup filename:/, 'test-backup.json')
  .stdout(/Backup completed/)
  .code(0)
```

**Installation:**
```bash
npm install --save-dev clet
```

### Alternative Tools
- **Execa**: Process execution with cleaner API
- **Inquirer mocking**: For unit testing prompts
- **memfs**: Virtual file system for testing

## Core Testing Strategies

### 1. Process-Based Testing
- Use `child_process.spawn()` for interactive scripts (not `exec`)
- Test CLI as separate processes to simulate real usage
- Capture stdin/stdout/stderr streams

### 2. Interactive Input Simulation
```javascript
// Wait for prompts and respond
.stdin(/Enter database URL:/, 'couchdb://localhost:5984')
.stdin(/Continue\? \(y\/n\):/, 'y')
.stdin(/Enter parallelism \(1-20\):/, '4')
```

### 3. Environment Isolation
- Use temporary directories for each test
- Mock file system operations when needed
- Set isolated environment variables
- Clean up processes and files after tests

### 4. Mock External Dependencies
```javascript
// Mock inquirer for prompt testing
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({
    dbUrl: 'mock://db',
    filename: 'test.json'
  })
}));
```

## Best Practices

### 1. Test User Experience, Not Implementation
- Focus on black-box testing
- Test complete workflows end-to-end
- Validate output users actually see
- Test error scenarios and edge cases

### 2. Handle Cross-Platform Differences
- Normalize path separators and line endings
- Account for different shell behaviors
- Test on multiple platforms when possible

### 3. Timeout & Process Management
```javascript
// Handle long-running operations
.wait('stdout', /Processing.../, { timeout: 30000 })
.kill() // Clean up long-running processes
```

### 4. File System Testing
```javascript
// Test backup file creation and content
const backupExists = fs.existsSync(backupPath);
const backupContent = JSON.parse(fs.readFileSync(backupPath));
expect(backupContent.docs).toBeDefined();
```

## Example Test Structure

### Basic E2E Test Template
```javascript
import { runner } from 'clet';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Backup Interactive E2E', () => {
  let testDir;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  });
  
  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should complete interactive backup flow', async () => {
    await runner()
      .cwd(testDir)
      .spawn('node', ['../scripts/backup-interactive.js'])
      .stdin(/Database URL:/, 'http://localhost:5984/testdb')
      .stdin(/Output filename:/, 'backup.json')
      .stdin(/Parallelism \(1-20\):/, '2')
      .stdout(/Starting backup/)
      .stdout(/Backup completed successfully/)
      .code(0);
      
    // Verify backup file exists and has content
    const backupPath = path.join(testDir, 'backup.json');
    expect(fs.existsSync(backupPath)).toBe(true);
    
    const backupContent = fs.readFileSync(backupPath, 'utf8');
    expect(backupContent.length).toBeGreaterThan(0);
  });
  
  it('should handle user cancellation', async () => {
    await runner()
      .cwd(testDir)
      .spawn('node', ['../scripts/backup-interactive.js'])
      .stdin(/Database URL:/, 'http://localhost:5984/testdb')
      .stdin(/Continue\? \(y\/n\):/, 'n')
      .stdout(/Operation cancelled/)
      .code(1);
  });
  
  it('should validate input parameters', async () => {
    await runner()
      .cwd(testDir)
      .spawn('node', ['../scripts/backup-interactive.js'])
      .stdin(/Database URL:/, 'invalid-url')
      .stderr(/Invalid database URL/)
      .code(1);
  });
});
```

### Testing Restore Operations
```javascript
describe('Restore Interactive E2E', () => {
  let testDir;
  let backupFile;
  
  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-test-'));
    backupFile = path.join(testDir, 'test-backup.json');
    
    // Create a mock backup file
    fs.writeFileSync(backupFile, JSON.stringify({
      docs: [
        { _id: 'test1', title: 'Test Todo 1' },
        { _id: 'test2', title: 'Test Todo 2' }
      ]
    }));
  });
  
  it('should restore from backup file', async () => {
    await runner()
      .cwd(testDir)
      .spawn('node', ['../scripts/restore-interactive.js'])
      .stdin(/Database URL:/, 'http://localhost:5984/testdb')
      .stdin(/Backup file path:/, backupFile)
      .stdin(/Confirm restore\? \(y\/n\):/, 'y')
      .stdout(/Restore completed successfully/)
      .code(0);
  });
});
```

## Testing Framework Integration

### With Vitest
```javascript
// vitest.config.js
export default {
  test: {
    testTimeout: 30000, // Longer timeout for CLI tests
    setupFiles: ['./test/setup.js']
  }
};
```

### With Jest
```javascript
// jest.config.js
module.exports = {
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/test/setup.js']
};
```

## Current Test Coverage Gaps

Our backup/restore scripts currently have minimal test coverage:

### Existing Tests
- `scripts/backup-interactive.test.ts` - Only tests configuration validation

### Missing E2E Tests
- Interactive backup workflow testing
- Restore operation testing
- Error handling and recovery scenarios
- File system operations validation
- Cross-platform compatibility
- Performance testing with large datasets

## Implementation Recommendations

### 1. Add E2E Test Suite
Create `scripts/__tests__/e2e/` directory with:
- `backup-interactive.e2e.test.ts`
- `restore-interactive.e2e.test.ts`
- `backup-restore-workflow.e2e.test.ts`

### 2. Test Environment Setup
- Mock CouchDB instance for testing
- Temporary directory management
- Test data fixtures
- Environment variable isolation

### 3. Integration with CI/CD
- Run E2E tests in CI pipeline
- Use containerized test environments
- Parallel test execution for faster feedback

### 4. Test Data Management
- Create realistic test datasets
- Test with various backup sizes
- Test migration scenarios between versions

## Resources

- [CLET GitHub Repository](https://github.com/node-modules/clet)
- [Testing CLI Applications - Smashing Magazine](https://www.smashingmagazine.com/2022/04/testing-cli-way-people-use-it/)
- [Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Philosophy

> "The more your tests resemble the way your software is used, the more confidence they can give you."

Focus on testing the user experience and actual usage patterns rather than purely technical implementation details. CLI testing should prioritize real-world scenarios and user workflows.