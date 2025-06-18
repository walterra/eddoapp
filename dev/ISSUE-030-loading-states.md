# ISSUE-009: Implement Loading States for Async Operations

**Priority:** High  
**Category:** User Experience  
**Estimated Effort:** 1-2 days  
**Impact:** Medium - Improves user experience and perceived performance  

## Description

The application currently lacks loading states for async operations, leaving users uncertain about whether their actions are being processed. This creates poor user experience, especially for database operations and time tracking functions.

## Current UX Issues

### Missing Loading Indicators
- **Todo Creation:** No feedback when adding new todos
- **Todo Updates:** No indication when editing todos
- **Database Sync:** No visual feedback during PouchDB operations
- **Time Tracking:** No loading state when starting/stopping timers
- **Data Migration:** No progress indication during schema migrations
- **Initial Load:** No loading state while fetching todos

### User Impact
- Users click buttons multiple times thinking they didn't work
- Uncertainty about whether operations completed successfully
- Poor perceived performance even when operations are fast
- No way to distinguish between slow operations and failures

## Implementation Strategy

### 1. Loading State Management Pattern
```typescript
// Custom hook for async operations
function useAsyncOperation<T>() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (operation: () => Promise<T>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      setData(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, data, execute };
}
```

### 2. Loading UI Components
```typescript
// Reusable loading components
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${
      size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
    }`} />
  );
}

function LoadingButton({ 
  isLoading, 
  children, 
  ...props 
}: ButtonProps & { isLoading: boolean }) {
  return (
    <button {...props} disabled={isLoading || props.disabled}>
      {isLoading ? (
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span>Processing...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
}
```

## Acceptance Criteria

- [ ] All async operations show loading states
- [ ] Loading indicators are visually consistent
- [ ] Users receive immediate feedback for all actions
- [ ] Loading states prevent duplicate submissions
- [ ] Error states are handled gracefully
- [ ] Loading indicators are accessible (screen readers)
- [ ] Performance impact is minimal
- [ ] Loading states work offline

## Implementation Plan

### Phase 1: Core Loading Infrastructure (Day 1)

1. **Create loading utilities**
   ```typescript
   // src/hooks/useAsyncOperation.ts
   // src/hooks/useLoadingState.ts
   // src/components/ui/LoadingSpinner.tsx
   // src/components/ui/LoadingButton.tsx
   ```

2. **Add loading state types**
   ```typescript
   // src/types/loading.ts
   export interface LoadingState {
     isLoading: boolean;
     error: Error | null;
   }

   export interface AsyncOperationState<T> extends LoadingState {
     data: T | null;
   }
   ```

### Phase 2: Todo Operations Loading (Day 1-2)

3. **Add loading to AddTodo component**
   ```typescript
   function AddTodo() {
     const { isLoading, execute } = useAsyncOperation();
     
     const handleSubmit = async (event: React.FormEvent) => {
       event.preventDefault();
       
       await execute(async () => {
         const validatedTodo = validateAndSanitizeTodo({
           title: todoTitle,
           context: todoContext,
           due: todoDue,
           link: todoLink
         });
         
         return await addTodo(validatedTodo);
       });
       
       // Reset form on success
       setTodoTitle('');
       // ... reset other fields
     };

     return (
       <form onSubmit={handleSubmit}>
         {/* form fields */}
         <LoadingButton isLoading={isLoading} type="submit">
           Add Todo
         </LoadingButton>
       </form>
     );
   }
   ```

4. **Add loading to TodoBoard**
   ```typescript
   function TodoBoard() {
     const [todosLoading, setTodosLoading] = useState(true);
     const [todos, setTodos] = useState<Todo[]>([]);

     useEffect(() => {
       const fetchTodos = async () => {
         setTodosLoading(true);
         try {
           const result = await db.allDocs({
             include_docs: true,
             startkey: startkey,
             endkey: endkey
           });
           setTodos(result.rows.map(row => row.doc as Todo));
         } catch (error) {
           console.error('Failed to fetch todos:', error);
         } finally {
           setTodosLoading(false);
         }
       };

       fetchTodos();
     }, [startkey, endkey]);

     if (todosLoading) {
       return (
         <div className="flex justify-center items-center h-64">
           <LoadingSpinner size="lg" />
           <span className="ml-2">Loading todos...</span>
         </div>
       );
     }

     return (
       <div>
         {/* todo list */}
       </div>
     );
   }
   ```

### Phase 3: Time Tracking Loading (Day 2)

5. **Add loading to time tracking operations**
   ```typescript
   function TimeTrackingButton({ todo }: { todo: Todo }) {
     const { isLoading, execute } = useAsyncOperation();
     const [isActive, setIsActive] = useState(isTimeActive(todo));

     const handleToggleTime = async () => {
       await execute(async () => {
         if (isActive) {
           return await stopTimeTracking(todo._id);
         } else {
           return await startTimeTracking(todo._id);
         }
       });
       
       setIsActive(!isActive);
     };

     return (
       <LoadingButton 
         isLoading={isLoading}
         onClick={handleToggleTime}
         className={isActive ? 'bg-red-500' : 'bg-green-500'}
       >
         {isActive ? 'Stop' : 'Start'}
       </LoadingButton>
     );
   }
   ```

6. **Add loading to todo updates**
   ```typescript
   function TodoListElement({ todo }: { todo: Todo }) {
     const { isLoading: isUpdating, execute } = useAsyncOperation();

     const handleComplete = async () => {
       await execute(async () => {
         const updatedTodo = {
           ...todo,
           completed: new Date().toISOString()
         };
         return await db.put(updatedTodo);
       });
     };

     return (
       <div className={`todo-item ${isUpdating ? 'opacity-50' : ''}`}>
         {/* todo content */}
         <LoadingButton 
           isLoading={isUpdating}
           onClick={handleComplete}
           size="sm"
         >
           Complete
         </LoadingButton>
       </div>
     );
   }
   ```

## Loading State Patterns

### 1. Button Loading States
```typescript
// Different button loading patterns
<LoadingButton isLoading={isSubmitting}>
  Submit
</LoadingButton>

// With custom loading text
<LoadingButton 
  isLoading={isSaving} 
  loadingText="Saving..."
>
  Save Changes
</LoadingButton>
```

### 2. Content Loading States
```typescript
// Full page loading
{isLoading ? (
  <LoadingSpinner size="lg" />
) : (
  <TodoList todos={todos} />
)}

// Inline loading with skeleton
{isLoading ? (
  <TodoSkeleton />
) : (
  <TodoItem todo={todo} />
)}
```

### 3. Progressive Loading
```typescript
// Show partial content while loading more
function TodoBoard() {
  return (
    <div>
      {todos.map(todo => (
        <TodoItem key={todo._id} todo={todo} />
      ))}
      {isLoadingMore && (
        <div className="flex justify-center p-4">
          <LoadingSpinner />
          <span>Loading more todos...</span>
        </div>
      )}
    </div>
  );
}
```

## Accessibility Considerations

### Screen Reader Support
```typescript
function LoadingSpinner({ 'aria-label': ariaLabel }: { 'aria-label'?: string }) {
  return (
    <div
      className="animate-spin ..."
      role="status"
      aria-label={ariaLabel || "Loading"}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
```

### Keyboard Navigation
```typescript
function LoadingButton({ isLoading, ...props }: ButtonProps & { isLoading: boolean }) {
  return (
    <button 
      {...props} 
      disabled={isLoading || props.disabled}
      aria-busy={isLoading}
    >
      {/* button content */}
    </button>
  );
}
```

## Performance Considerations

### Debounced Loading States
```typescript
// Prevent loading flicker for fast operations
function useDebouncedLoading(isLoading: boolean, delay: number = 200) {
  const [debouncedLoading, setDebouncedLoading] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setDebouncedLoading(true), delay);
      return () => clearTimeout(timer);
    } else {
      setDebouncedLoading(false);
    }
  }, [isLoading, delay]);

  return debouncedLoading;
}
```

### Optimistic Updates
```typescript
// Show immediate feedback while operation completes in background
function useOptimisticUpdate<T>(
  data: T,
  updateFn: (data: T) => Promise<T>
) {
  const [optimisticData, setOptimisticData] = useState(data);
  const [isLoading, setIsLoading] = useState(false);

  const execute = async (optimisticValue: T) => {
    setOptimisticData(optimisticValue);
    setIsLoading(true);

    try {
      const result = await updateFn(optimisticValue);
      setOptimisticData(result);
      return result;
    } catch (error) {
      setOptimisticData(data); // Revert on error
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { data: optimisticData, isLoading, execute };
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('useAsyncOperation', () => {
  it('should handle loading states correctly', async () => {
    const { result } = renderHook(() => useAsyncOperation());
    
    expect(result.current.isLoading).toBe(false);

    const operation = vi.fn().mockResolvedValue('success');
    
    act(() => {
      result.current.execute(operation);
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe('success');
  });
});
```

### Integration Tests
```typescript
describe('TodoBoard loading states', () => {
  it('should show loading spinner while fetching todos', async () => {
    render(<TodoBoard />);
    
    expect(screen.getByText('Loading todos...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText('Loading todos...')).not.toBeInTheDocument();
    });
  });
});
```

## Dependencies

- Works well with ISSUE-004 (error boundaries) for complete error handling
- Benefits from ISSUE-003 (testing) for comprehensive test coverage
- Can be implemented alongside other UX improvements

## Definition of Done

- All async operations show appropriate loading states
- Loading indicators are visually consistent across the app
- Loading states are accessible to screen readers
- Users can't trigger duplicate operations during loading
- Error states are handled gracefully with loading states
- Performance impact is minimal (debounced for fast operations)
- Loading states work properly offline
- Comprehensive test coverage for loading scenarios
- Documentation updated with loading state patterns