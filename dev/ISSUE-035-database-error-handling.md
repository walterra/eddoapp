# ISSUE-014: Implement Proper Database Error Handling

**Priority:** High  
**Category:** Error Handling  
**Estimated Effort:** 2-3 days  
**Impact:** High - Prevents data loss and improves reliability  

## Description

The application currently has minimal error handling for PouchDB operations, which can lead to data loss, poor user experience, and difficult debugging. Proper database error handling is critical for a data-centric application.

## Current Database Issues

### Missing Error Handling
- Database initialization failures not handled
- PouchDB operation errors not caught consistently
- No retry logic for transient failures
- Sync conflicts not properly resolved
- Quota exceeded errors not handled
- Network failures during sync not managed

### Problematic Code Patterns
```typescript
// Current pattern - NO ERROR HANDLING
await db.put(todo);  // ❌ Can fail silently
const result = await db.allDocs(); // ❌ No error handling
```

### User Impact
- Data loss when operations fail
- App crashes on database errors
- No feedback when operations fail
- Inconsistent data state
- Poor offline experience

## Implementation Strategy

### 1. Database Error Types
```typescript
// src/types/database-errors.ts
export enum DatabaseErrorType {
  INITIALIZATION_FAILED = 'initialization_failed',
  OPERATION_FAILED = 'operation_failed',
  QUOTA_EXCEEDED = 'quota_exceeded',
  NETWORK_ERROR = 'network_error',
  SYNC_CONFLICT = 'sync_conflict',
  CORRUPTION = 'corruption',
  PERMISSION_DENIED = 'permission_denied'
}

export interface DatabaseError extends Error {
  type: DatabaseErrorType;
  originalError?: Error;
  operation?: string;
  document?: string;
  retryable: boolean;
}

export class DatabaseOperationError extends Error implements DatabaseError {
  type: DatabaseErrorType;
  originalError?: Error;
  operation?: string;
  document?: string;
  retryable: boolean;

  constructor(
    type: DatabaseErrorType,
    message: string,
    options: {
      originalError?: Error;
      operation?: string;
      document?: string;
      retryable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'DatabaseOperationError';
    this.type = type;
    this.originalError = options.originalError;
    this.operation = options.operation;
    this.document = options.document;
    this.retryable = options.retryable ?? false;
  }
}
```

### 2. Safe Database Operations Wrapper
```typescript
// src/api/safe-db-operations.ts
export class SafeDbOperations {
  private db: PouchDB.Database;
  private retryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000
  };

  constructor(db: PouchDB.Database) {
    this.db = db;
  }

  async safeGet<T>(id: string): Promise<T | null> {
    try {
      return await this.withRetry(() => this.db.get<T>(id), 'get', id);
    } catch (error) {
      if (error.name === 'not_found') {
        return null;
      }
      throw this.createDatabaseError(error, 'get', id);
    }
  }

  async safePut<T>(doc: T & { _id: string }): Promise<T> {
    try {
      const result = await this.withRetry(
        () => this.db.put(doc),
        'put',
        doc._id
      );
      
      return { ...doc, _rev: result.rev };
    } catch (error) {
      throw this.createDatabaseError(error, 'put', doc._id);
    }
  }

  async safeRemove(doc: { _id: string; _rev: string }): Promise<void> {
    try {
      await this.withRetry(
        () => this.db.remove(doc),
        'remove',
        doc._id
      );
    } catch (error) {
      throw this.createDatabaseError(error, 'remove', doc._id);
    }
  }

  async safeAllDocs<T>(options: PouchDB.Core.AllDocsOptions = {}): Promise<T[]> {
    try {
      const result = await this.withRetry(
        () => this.db.allDocs({ include_docs: true, ...options }),
        'allDocs'
      );
      
      return result.rows
        .filter(row => row.doc)
        .map(row => row.doc as T);
    } catch (error) {
      throw this.createDatabaseError(error, 'allDocs');
    }
  }

  async safeBulkDocs<T>(docs: T[]): Promise<T[]> {
    try {
      const results = await this.withRetry(
        () => this.db.bulkDocs(docs),
        'bulkDocs'
      );
      
      // Handle individual document errors
      const successful: T[] = [];
      const errors: DatabaseError[] = [];
      
      results.forEach((result, index) => {
        if ('error' in result) {
          errors.push(this.createDatabaseError(
            new Error(result.error),
            'bulkDocs',
            docs[index]?._id || `doc-${index}`
          ));
        } else {
          successful.push({
            ...docs[index],
            _rev: result.rev
          });
        }
      });
      
      if (errors.length > 0) {
        console.warn('Some documents failed to save:', errors);
        // Decide whether to throw or return partial success
      }
      
      return successful;
    } catch (error) {
      throw this.createDatabaseError(error, 'bulkDocs');
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    documentId?: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry non-retryable errors
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay
        );
        
        console.warn(
          `Database operation "${operationName}" failed (attempt ${attempt}/${this.retryConfig.maxRetries}). Retrying in ${delay}ms...`,
          error
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    // Network errors are usually retryable
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }
    
    // Timeout errors are retryable
    if (error.name === 'timeout') {
      return true;
    }
    
    // Some HTTP errors are retryable
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // Rate limiting is retryable
    if (error.status === 429) {
      return true;
    }
    
    // Document conflicts need manual resolution, not retry
    if (error.name === 'conflict') {
      return false;
    }
    
    // Permission errors are not retryable
    if (error.status === 401 || error.status === 403) {
      return false;
    }
    
    return false;
  }

  private createDatabaseError(
    error: any,
    operation: string,
    documentId?: string
  ): DatabaseError {
    let type: DatabaseErrorType;
    let retryable = false;
    
    switch (error.name) {
      case 'quota_exceeded':
        type = DatabaseErrorType.QUOTA_EXCEEDED;
        break;
      case 'conflict':
        type = DatabaseErrorType.SYNC_CONFLICT;
        break;
      case 'TypeError':
        if (error.message.includes('fetch')) {
          type = DatabaseErrorType.NETWORK_ERROR;
          retryable = true;
        } else {
          type = DatabaseErrorType.OPERATION_FAILED;
        }
        break;
      default:
        if (error.status >= 500) {
          type = DatabaseErrorType.NETWORK_ERROR;
          retryable = true;
        } else {
          type = DatabaseErrorType.OPERATION_FAILED;
        }
    }
    
    return new DatabaseOperationError(
      type,
      `Database operation "${operation}" failed: ${error.message}`,
      {
        originalError: error,
        operation,
        document: documentId,
        retryable
      }
    );
  }
}
```

## Acceptance Criteria

- [ ] All database operations wrapped with proper error handling
- [ ] Retry logic implemented for transient failures
- [ ] User-friendly error messages for different error types
- [ ] Conflict resolution strategy for sync conflicts
- [ ] Quota exceeded graceful handling
- [ ] Network error recovery mechanisms
- [ ] Error logging for debugging and monitoring
- [ ] Graceful degradation when database is unavailable

## Implementation Plan

### Phase 1: Core Error Handling Infrastructure (Day 1)

1. **Create error types and classes**
   ```typescript
   // src/types/database-errors.ts
   // src/api/safe-db-operations.ts
   ```

2. **Update PouchDB context provider**
   ```typescript
   // src/pouch_db.ts
   import { SafeDbOperations } from './api/safe-db-operations';

   const PouchDbContext = createContext<{
     db: PouchDB.Database;
     safeDb: SafeDbOperations;
   } | null>(null);

   export function PouchDbProvider({ children }: { children: React.ReactNode }) {
     const [dbInstance] = useState(() => {
       const db = new PouchDB('todos');
       const safeDb = new SafeDbOperations(db);
       return { db, safeDb };
     });

     return (
       <PouchDbContext.Provider value={dbInstance}>
         {children}
       </PouchDbContext.Provider>
     );
   }

   export function usePouchDb() {
     const context = useContext(PouchDbContext);
     if (!context) {
       throw new Error('usePouchDb must be used within PouchDbProvider');
     }
     return context;
   }
   ```

### Phase 2: Update Components to Use Safe Operations (Day 1-2)

3. **Update TodoBoard component**
   ```typescript
   function TodoBoard() {
     const { safeDb } = usePouchDb();
     const [todos, setTodos] = useState<Todo[]>([]);
     const [error, setError] = useState<DatabaseError | null>(null);
     const [isLoading, setIsLoading] = useState(true);

     const fetchTodos = useCallback(async () => {
       setIsLoading(true);
       setError(null);
       
       try {
         const fetchedTodos = await safeDb.safeAllDocs<Todo>({
           startkey: startkey,
           endkey: endkey
         });
         setTodos(fetchedTodos);
       } catch (error) {
         console.error('Failed to fetch todos:', error);
         setError(error as DatabaseError);
         
         // Show user-friendly error message
         if (error.type === DatabaseErrorType.NETWORK_ERROR) {
           // Show offline mode or retry option
         } else if (error.type === DatabaseErrorType.QUOTA_EXCEEDED) {
           // Show storage cleanup options
         }
       } finally {
         setIsLoading(false);
       }
     }, [safeDb, startkey, endkey]);

     // Error recovery UI
     if (error) {
       return (
         <DatabaseErrorFallback 
           error={error} 
           onRetry={fetchTodos}
           onDismiss={() => setError(null)}
         />
       );
     }

     // ... rest of component
   }
   ```

4. **Update AddTodo component**
   ```typescript
   function AddTodo() {
     const { safeDb } = usePouchDb();
     const [error, setError] = useState<DatabaseError | null>(null);

     const handleSubmit = async (event: React.FormEvent) => {
       event.preventDefault();
       setError(null);

       try {
         const todo: TodoAlpha3 = {
           _id: new Date().toISOString(),
           title: todoTitle,
           context: todoContext,
           due: todoDue,
           link: todoLink,
           description: '',
           active: {},
           completed: null,
           repeat: null,
           tags: [],
           version: 'alpha3'
         };

         await safeDb.safePut(todo);
         
         // Reset form on success
         setTodoTitle('');
         setTodoContext('');
         // ... reset other fields
         
       } catch (error) {
         console.error('Failed to create todo:', error);
         setError(error as DatabaseError);
       }
     };

     return (
       <form onSubmit={handleSubmit}>
         {/* form fields */}
         
         {error && (
           <DatabaseErrorMessage 
             error={error}
             onDismiss={() => setError(null)}
           />
         )}
         
         <button type="submit">Add Todo</button>
       </form>
     );
   }
   ```

### Phase 3: Error UI Components (Day 2)

5. **Create error display components**
   ```typescript
   // src/components/DatabaseErrorFallback.tsx
   interface DatabaseErrorFallbackProps {
     error: DatabaseError;
     onRetry?: () => void;
     onDismiss?: () => void;
   }

   function DatabaseErrorFallback({ error, onRetry, onDismiss }: DatabaseErrorFallbackProps) {
     const getErrorMessage = (error: DatabaseError) => {
       switch (error.type) {
         case DatabaseErrorType.NETWORK_ERROR:
           return "Unable to connect to the database. Please check your internet connection.";
         case DatabaseErrorType.QUOTA_EXCEEDED:
           return "Storage quota exceeded. Please clear some data to continue.";
         case DatabaseErrorType.SYNC_CONFLICT:
           return "Data conflict detected. Your changes may need to be merged.";
         default:
           return "A database error occurred. Please try again.";
       }
     };

     const getActionButtons = (error: DatabaseError) => {
       const buttons = [];
       
       if (error.retryable && onRetry) {
         buttons.push(
           <button key="retry" onClick={onRetry} className="btn-primary">
             Try Again
           </button>
         );
       }
       
       if (error.type === DatabaseErrorType.QUOTA_EXCEEDED) {
         buttons.push(
           <button key="cleanup" onClick={() => {/* open cleanup modal */}}>
             Free Up Space
           </button>
         );
       }
       
       if (onDismiss) {
         buttons.push(
           <button key="dismiss" onClick={onDismiss} className="btn-secondary">
             Dismiss
           </button>
         );
       }
       
       return buttons;
     };

     return (
       <div className="database-error-fallback">
         <div className="error-icon">⚠️</div>
         <h3>Database Error</h3>
         <p>{getErrorMessage(error)}</p>
         
         {process.env.NODE_ENV === 'development' && (
           <details className="error-details">
             <summary>Technical Details</summary>
             <pre>{JSON.stringify(error, null, 2)}</pre>
           </details>
         )}
         
         <div className="error-actions">
           {getActionButtons(error)}
         </div>
       </div>
     );
   }
   ```

### Phase 4: Advanced Error Handling (Day 2-3)

6. **Implement conflict resolution**
   ```typescript
   // src/api/conflict-resolution.ts
   export class ConflictResolver {
     static async resolveConflict<T extends { _id: string; _rev: string }>(
       db: PouchDB.Database,
       doc: T,
       strategy: 'latest-wins' | 'manual' = 'latest-wins'
     ): Promise<T> {
       if (strategy === 'latest-wins') {
         // Get the latest version from database
         const latest = await db.get<T>(doc._id);
         
         // Merge changes (simple strategy - keep latest doc, update specific fields)
         const merged = {
           ...latest,
           ...doc,
           _rev: latest._rev // Use database revision
         };
         
         return await db.put(merged);
       }
       
       // For manual resolution, throw error for UI to handle
       throw new DatabaseOperationError(
         DatabaseErrorType.SYNC_CONFLICT,
         'Manual conflict resolution required',
         { document: doc._id, retryable: false }
       );
     }
   }
   ```

7. **Add database health monitoring**
   ```typescript
   // src/hooks/useDatabaseHealth.ts
   export function useDatabaseHealth() {
     const { db } = usePouchDb();
     const [health, setHealth] = useState<'healthy' | 'degraded' | 'offline'>('healthy');

     useEffect(() => {
       const checkHealth = async () => {
         try {
           await db.info();
           setHealth('healthy');
         } catch (error) {
           console.warn('Database health check failed:', error);
           setHealth('offline');
         }
       };

       // Check health periodically
       const interval = setInterval(checkHealth, 30000); // 30 seconds
       checkHealth(); // Initial check

       return () => clearInterval(interval);
     }, [db]);

     return health;
   }
   ```

## Testing Strategy

### Error Simulation Tests
```typescript
// src/__tests__/database-error-handling.test.ts
describe('Database Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    const mockDb = {
      put: vi.fn().mockRejectedValue(new Error('Network error'))
    };
    
    const safeDb = new SafeDbOperations(mockDb as any);
    
    await expect(safeDb.safePut({ _id: 'test' }))
      .rejects.toThrow(DatabaseOperationError);
  });

  it('should retry retryable errors', async () => {
    const mockDb = {
      put: vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, rev: 'rev1' })
    };
    
    const safeDb = new SafeDbOperations(mockDb as any);
    
    const result = await safeDb.safePut({ _id: 'test' });
    expect(mockDb.put).toHaveBeenCalledTimes(2);
    expect(result).toHaveProperty('_rev', 'rev1');
  });
});
```

## Dependencies

- Works with ISSUE-004 (error boundaries) for complete error handling
- Benefits from ISSUE-009 (loading states) for better UX during operations
- Complements ISSUE-003 (testing) for error scenario coverage

## Definition of Done

- All database operations use safe wrappers with proper error handling
- Retry logic implemented for appropriate error types
- User-friendly error messages displayed for all error scenarios
- Conflict resolution strategy implemented
- Database health monitoring active
- Error recovery mechanisms provide clear user actions
- Comprehensive error handling tests cover all scenarios
- Error logging provides sufficient debugging information
- Graceful degradation when database is unavailable
- Documentation updated with error handling patterns