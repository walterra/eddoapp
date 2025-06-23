# Database Unit Testing Guide for PouchDB/CouchDB Applications

This guide documents best practices for writing proper unit tests when working with PouchDB in database-centric, offline-first applications.

## Table of Contents

1. [Overview](#overview)
2. [Testing Architecture](#testing-architecture)
3. [Memory Adapter Setup](#memory-adapter-setup)
4. [Test Isolation Patterns](#test-isolation-patterns)
5. [Mocking Strategies](#mocking-strategies)
6. [React Hooks Testing](#react-hooks-testing)
7. [Integration Testing](#integration-testing)
8. [Best Practices](#best-practices)
9. [Common Pitfalls](#common-pitfalls)
10. [Example Test Patterns](#example-test-patterns)

## Overview

PouchDB is an offline-first database that replicates CouchDB's functionality in the browser and Node.js. Testing PouchDB applications requires special considerations due to:

- Asynchronous operations and promises
- Multiple storage adapters (leveldb, memory, idb, indexeddb)
- Offline-first architecture patterns
- Real-time sync and changes feed
- Database-centric state management

## Testing Architecture

### Database-Centric Testing Philosophy

In database-centric applications, PouchDB serves as both storage and state management. Tests should:

1. **Test the database interactions directly** - Since PouchDB is the source of truth
2. **Use isolated database instances** - Each test gets a fresh database
3. **Test offline scenarios** - Verify functionality without network access
4. **Test sync scenarios** - Verify replication and conflict resolution

### Test Categories

1. **Unit Tests**: Individual functions and components in isolation
2. **Integration Tests**: Component interactions with PouchDB
3. **E2E Tests**: Full application workflows including sync

## Memory Adapter Setup

The memory adapter is essential for testing as it provides:
- Fast test execution (no disk I/O)
- Complete isolation between tests
- Predictable starting state

### Installation

```bash
pnpm add -D pouchdb-adapter-memory
```

### Basic Setup

```typescript
import PouchDB from 'pouchdb'
import memory from 'pouchdb-adapter-memory'

// Add the adapter
PouchDB.plugin(memory)

// Create test database
const testDb = new PouchDB('test-db', { adapter: 'memory' })
```

## Test Isolation Patterns

### Pattern 1: Database Per Test

```typescript
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import PouchDB from 'pouchdb'
import memory from 'pouchdb-adapter-memory'

PouchDB.plugin(memory)

describe('Todo Operations', () => {
  let db: PouchDB.Database

  beforeEach(() => {
    // Create fresh database for each test
    db = new PouchDB('test-todos', { adapter: 'memory' })
  })

  afterEach(async () => {
    // Clean up after each test
    await db.destroy()
  })

  it('should create a todo', async () => {
    const todo = {
      _id: '2025-01-01T00:00:00.000Z',
      title: 'Test Todo',
      completed: false
    }

    const result = await db.put(todo)
    expect(result.ok).toBe(true)

    const retrieved = await db.get(todo._id)
    expect(retrieved.title).toBe('Test Todo')
  })
})
```

### Pattern 2: Unique Database Names

```typescript
describe('Parallel Tests', () => {
  it('should handle multiple databases', async () => {
    const dbName = `test-${Date.now()}-${Math.random()}`
    const db = new PouchDB(dbName, { adapter: 'memory' })
    
    try {
      // Test operations
      await db.put({ _id: 'test', value: 'data' })
      const doc = await db.get('test')
      expect(doc.value).toBe('data')
    } finally {
      await db.destroy()
    }
  })
})
```

## Mocking Strategies

### Strategy 1: Full Mock for Unit Tests

When testing business logic without database interaction:

```typescript
import { vi } from 'vitest'

// Mock PouchDB entirely
vi.mock('pouchdb', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      put: vi.fn(),
      allDocs: vi.fn(),
      changes: vi.fn(),
      destroy: vi.fn()
    }))
  }
})
```

### Strategy 2: Selective Mocking

Mock specific methods while keeping others real:

```typescript
import PouchDB from 'pouchdb'

const createMockDb = () => {
  const db = new PouchDB('test', { adapter: 'memory' })
  
  // Mock specific methods
  const originalPut = db.put.bind(db)
  db.put = vi.fn().mockImplementation(async (doc) => {
    console.log('Mocked put called with:', doc)
    return originalPut(doc)
  })
  
  return db
}
```

### Strategy 3: Network Mocking

For testing sync scenarios:

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('http://localhost:5984/todos/_all_docs', () => {
    return HttpResponse.json({
      total_rows: 0,
      offset: 0,
      rows: []
    })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## React Hooks Testing

### Testing Custom PouchDB Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { Provider } from 'use-pouchdb'
import { usePouchDb } from '../hooks/usePouchDb'

describe('usePouchDb Hook', () => {
  let db: PouchDB.Database

  beforeEach(() => {
    db = new PouchDB('test-hook', { adapter: 'memory' })
  })

  afterEach(async () => {
    await db.destroy()
  })

  it('should fetch todos', async () => {
    // Pre-populate test data
    await db.bulkDocs([
      { _id: '1', title: 'Todo 1', completed: false },
      { _id: '2', title: 'Todo 2', completed: true }
    ])

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider pouchdb={db}>{children}</Provider>
    )

    const { result } = renderHook(() => usePouchDb(), { wrapper })

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2)
    })

    expect(result.current.todos[0].title).toBe('Todo 1')
  })
})
```

### Testing Component Integration

```typescript
import { render, screen } from '@testing-library/react'
import { Provider } from 'use-pouchdb'
import TodoList from '../components/TodoList'

describe('TodoList Component', () => {
  let db: PouchDB.Database

  beforeEach(() => {
    db = new PouchDB('test-component', { adapter: 'memory' })
  })

  afterEach(async () => {
    await db.destroy()
  })

  it('should display todos from database', async () => {
    await db.bulkDocs([
      { _id: '1', title: 'Buy groceries', completed: false },
      { _id: '2', title: 'Walk the dog', completed: true }
    ])

    render(
      <Provider pouchdb={db}>
        <TodoList />
      </Provider>
    )

    expect(await screen.findByText('Buy groceries')).toBeInTheDocument()
    expect(await screen.findByText('Walk the dog')).toBeInTheDocument()
  })
})
```

## Integration Testing

### Testing Database Migrations

```typescript
describe('Database Migrations', () => {
  it('should migrate from alpha2 to alpha3', async () => {
    const db = new PouchDB('migration-test', { adapter: 'memory' })

    // Insert alpha2 document
    await db.put({
      _id: '2025-01-01T00:00:00.000Z',
      title: 'Test Todo',
      version: 'alpha2'
    })

    // Run migration
    await migrateToAlpha3(db)

    // Verify migration
    const doc = await db.get('2025-01-01T00:00:00.000Z')
    expect(doc.version).toBe('alpha3')
    expect(doc.link).toBe(null) // New field added

    await db.destroy()
  })
})
```

### Testing Sync Scenarios

```typescript
describe('Database Sync', () => {
  it('should handle sync conflicts', async () => {
    const localDb = new PouchDB('local', { adapter: 'memory' })
    const remoteDb = new PouchDB('remote', { adapter: 'memory' })

    // Create conflicting documents
    await localDb.put({ _id: 'conflict', title: 'Local Version', _rev: '1-local' })
    await remoteDb.put({ _id: 'conflict', title: 'Remote Version', _rev: '1-remote' })

    // Test sync
    const sync = localDb.sync(remoteDb)
    await sync

    // Verify conflict resolution
    const doc = await localDb.get('conflict', { conflicts: true })
    expect(doc._conflicts).toBeDefined()

    await localDb.destroy()
    await remoteDb.destroy()
  })
})
```

## Best Practices

### 1. Database Lifecycle Management

```typescript
// Good: Clean setup and teardown
beforeEach(async () => {
  db = new PouchDB(`test-${Date.now()}`, { adapter: 'memory' })
})

afterEach(async () => {
  if (db) {
    await db.destroy()
  }
})

// Bad: Shared database state
const db = new PouchDB('shared-test-db') // Don't do this
```

### 2. Test Data Management

```typescript
// Good: Explicit test data setup
const setupTestData = async (db: PouchDB.Database) => {
  return await db.bulkDocs([
    { _id: '1', title: 'Test 1', version: 'alpha3' },
    { _id: '2', title: 'Test 2', version: 'alpha3' }
  ])
}

// Bad: Implicit dependencies on existing data
```

### 3. Async/Await Patterns

```typescript
// Good: Proper async handling
it('should create document', async () => {
  const result = await db.put({ _id: 'test', data: 'value' })
  expect(result.ok).toBe(true)
})

// Bad: Not handling promises
it('should create document', () => {
  db.put({ _id: 'test', data: 'value' }) // Missing await
  // Test may pass inconsistently
})
```

### 4. Error Testing

```typescript
it('should handle document not found', async () => {
  await expect(db.get('nonexistent')).rejects.toMatchObject({
    status: 404,
    name: 'not_found'
  })
})
```

### 5. Changes Feed Testing

```typescript
it('should react to database changes', async () => {
  const changes: any[] = []
  
  const changeHandler = db.changes({
    since: 'now',
    live: true,
    include_docs: true
  }).on('change', (change) => {
    changes.push(change)
  })

  await db.put({ _id: 'test', title: 'New Todo' })
  
  // Wait for change to propagate
  await new Promise(resolve => setTimeout(resolve, 100))
  
  expect(changes).toHaveLength(1)
  expect(changes[0].doc.title).toBe('New Todo')
  
  changeHandler.cancel()
})
```

## Common Pitfalls

### 1. Database Name Collisions

```typescript
// Problem: Multiple tests use same database name
const db1 = new PouchDB('test')
const db2 = new PouchDB('test') // Shares data with db1!

// Solution: Unique names
const db1 = new PouchDB(`test-${Date.now()}-1`)
const db2 = new PouchDB(`test-${Date.now()}-2`)
```

### 2. Incomplete Cleanup

```typescript
// Problem: Not destroying database
afterEach(() => {
  db = null // Memory leak!
})

// Solution: Proper cleanup
afterEach(async () => {
  if (db) {
    await db.destroy()
    db = null
  }
})
```

### 3. Race Conditions

```typescript
// Problem: Not waiting for async operations
it('should update document', () => {
  db.put({ _id: 'test', version: 1 })
  db.put({ _id: 'test', version: 2 }) // May fail due to race condition
})

// Solution: Await operations
it('should update document', async () => {
  const doc1 = await db.put({ _id: 'test', version: 1 })
  await db.put({ _id: 'test', _rev: doc1.rev, version: 2 })
})
```

### 4. Testing Against Wrong Adapter

```typescript
// Problem: Testing against different adapter than production
const db = new PouchDB('test') // Uses default adapter

// Solution: Explicit adapter for consistency
const db = new PouchDB('test', { adapter: 'memory' })
```

## Example Test Patterns

### Testing Complex Queries

```typescript
describe('Todo Queries', () => {
  let db: PouchDB.Database

  beforeEach(async () => {
    db = new PouchDB('query-test', { adapter: 'memory' })
    
    // Setup design document for views
    await db.put({
      _id: '_design/todos',
      views: {
        by_status: {
          map: `function(doc) {
            if (doc.completed !== undefined) {
              emit(doc.completed, doc);
            }
          }`
        }
      }
    })

    // Add test data
    await db.bulkDocs([
      { _id: '1', title: 'Complete Task', completed: true },
      { _id: '2', title: 'Pending Task', completed: false },
      { _id: '3', title: 'Another Pending', completed: false }
    ])
  })

  afterEach(async () => {
    await db.destroy()
  })

  it('should query completed todos', async () => {
    const result = await db.query('todos/by_status', {
      key: true,
      include_docs: true
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].doc.title).toBe('Complete Task')
  })

  it('should query pending todos', async () => {
    const result = await db.query('todos/by_status', {
      key: false,
      include_docs: true
    })

    expect(result.rows).toHaveLength(2)
  })
})
```

### Testing Error Scenarios

```typescript
describe('Error Handling', () => {
  let db: PouchDB.Database

  beforeEach(() => {
    db = new PouchDB('error-test', { adapter: 'memory' })
  })

  afterEach(async () => {
    await db.destroy()
  })

  it('should handle document conflicts', async () => {
    const doc = { _id: 'conflict-test', data: 'original' }
    const result1 = await db.put(doc)
    
    // Create conflicting update
    const conflictDoc = { _id: 'conflict-test', data: 'conflict', _rev: result1.rev }
    const updatedDoc = { _id: 'conflict-test', data: 'updated', _rev: result1.rev }
    
    await db.put(conflictDoc)
    
    // This should fail with conflict
    await expect(db.put(updatedDoc)).rejects.toMatchObject({
      status: 409,
      name: 'conflict'
    })
  })

  it('should handle network timeouts', async () => {
    // Mock a slow operation
    const slowDb = new PouchDB('slow-test', { adapter: 'memory' })
    const originalPut = slowDb.put.bind(slowDb)
    
    slowDb.put = vi.fn().mockImplementation(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 100)
      )
    )

    await expect(slowDb.put({ _id: 'test' })).rejects.toThrow('timeout')
    await slowDb.destroy()
  })
})
```

### Performance Testing

```typescript
describe('Performance Tests', () => {
  let db: PouchDB.Database

  beforeEach(() => {
    db = new PouchDB('perf-test', { adapter: 'memory' })
  })

  afterEach(async () => {
    await db.destroy()
  })

  it('should handle bulk operations efficiently', async () => {
    const docs = Array.from({ length: 1000 }, (_, i) => ({
      _id: `doc-${i}`,
      title: `Todo ${i}`,
      completed: i % 2 === 0
    }))

    const start = Date.now()
    await db.bulkDocs(docs)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(1000) // Should complete within 1 second

    const result = await db.allDocs()
    expect(result.rows).toHaveLength(1000)
  })
})
```

This guide provides a comprehensive foundation for testing PouchDB applications. Adapt these patterns to your specific use case and testing requirements.