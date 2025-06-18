# ISSUE-006: Fix Memory Leak in Timer Implementation

**Priority:** High  
**Category:** Performance  
**Estimated Effort:** 1-2 days  
**Impact:** High - Causes memory leaks and potential crashes  

## Description

The `TodoBoard` component contains a recursive timer implementation in `updateActiveCounter()` that creates a memory leak. The function calls itself indefinitely without proper cleanup, leading to multiple active timers and potential memory exhaustion.

## Current Implementation Problem

### Problematic Code
```typescript
// In TodoBoard component - PROBLEMATIC
function updateActiveCounter() {
  setTimeout(() => {
    if (active) {
      setActiveCounter((state) => state + 1);
      updateActiveCounter(); // 🚨 Recursive call without cleanup
    }
  }, 1000);
}
```

### Issues Identified
1. **Memory Leak:** Recursive `setTimeout` calls accumulate without cleanup
2. **Multiple Timers:** Component re-renders can create multiple timer instances
3. **No Cleanup:** No mechanism to cancel running timers
4. **State Stale Closure:** Timer may reference stale state values
5. **Performance Degradation:** Accumulated timers consume increasing CPU/memory

## Root Cause Analysis

### Technical Issues
- Recursive `setTimeout` without cleanup mechanism
- Timer continues running even when component unmounts
- No dependency tracking for the `active` state
- Missing cleanup in `useEffect` dependencies

### Impact Assessment
- **Memory Usage:** Grows linearly with time
- **CPU Usage:** Multiple timers executing simultaneously
- **Battery Drain:** Continuous timer execution on mobile devices
- **Application Stability:** Potential crash with long-running sessions

## Proposed Solution

### 1. Replace with Proper useEffect Hook

```typescript
// Proper implementation with cleanup
useEffect(() => {
  if (!active) return;

  const intervalId = setInterval(() => {
    setActiveCounter(prev => prev + 1);
  }, 1000);

  // Cleanup function
  return () => {
    clearInterval(intervalId);
  };
}, [active]); // Proper dependency array
```

### 2. Custom Hook for Timer Management

```typescript
// Custom hook for reusable timer logic
function useTimer(isActive: boolean, interval: number = 1000) {
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setCounter(0);
      return;
    }

    const intervalId = setInterval(() => {
      setCounter(prev => prev + 1);
    }, interval);

    return () => clearInterval(intervalId);
  }, [isActive, interval]);

  return counter;
}

// Usage in component
const activeCounter = useTimer(active);
```

### 3. Performance-Optimized Solution

```typescript
// Advanced solution with performance optimizations
function useActiveTimer(active: boolean) {
  const [counter, setCounter] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(() => {
    if (intervalRef.current) return; // Prevent multiple timers

    intervalRef.current = setInterval(() => {
      setCounter(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    setCounter(0);
  }, [stopTimer]);

  useEffect(() => {
    if (active) {
      startTimer();
    } else {
      stopTimer();
      setCounter(0);
    }

    return stopTimer; // Cleanup on unmount
  }, [active, startTimer, stopTimer]);

  return { counter, resetTimer };
}
```

## Acceptance Criteria

- [ ] Memory leak eliminated - no accumulating timers
- [ ] Single timer instance per active todo
- [ ] Proper cleanup when component unmounts
- [ ] Timer stops when todo becomes inactive
- [ ] No performance degradation over time
- [ ] Timer resets correctly when restarted
- [ ] State updates work correctly with new implementation

## Implementation Plan

### Step 1: Identify All Timer Usage (30 minutes)
1. **Audit codebase for timer patterns**
   ```bash
   grep -r "setTimeout\|setInterval" src/
   grep -r "updateActiveCounter" src/
   ```

2. **Document current timer implementations**
   - Location of problematic code
   - Dependencies and usage patterns
   - Impact assessment

### Step 2: Implement Custom Hook (2-3 hours)
1. **Create `useActiveTimer` hook**
   - File: `src/hooks/useActiveTimer.ts`
   - Include TypeScript types
   - Add comprehensive JSDoc comments

2. **Add hook tests**
   - File: `src/hooks/useActiveTimer.test.ts`
   - Test timer start/stop/reset functionality
   - Test cleanup behavior
   - Test multiple instances

### Step 3: Update Components (2-3 hours)
1. **Replace timer implementation in TodoBoard**
   - Remove `updateActiveCounter` function
   - Replace with `useActiveTimer` hook
   - Update state management

2. **Update any other components using timers**
   - Apply consistent timer pattern
   - Ensure proper cleanup

### Step 4: Testing and Validation (2-4 hours)
1. **Manual testing**
   - Start/stop multiple todos
   - Leave application running for extended period
   - Monitor browser memory usage
   - Test component unmounting

2. **Automated testing**
   - Unit tests for timer hook
   - Integration tests for component behavior
   - Memory leak detection tests

## Testing Strategy

### Memory Leak Testing
```typescript
// Test to verify no memory leaks
describe('useActiveTimer memory management', () => {
  it('should cleanup timer on unmount', () => {
    const { unmount } = renderHook(() => useActiveTimer(true));
    
    // Verify timer is running
    expect(setInterval).toHaveBeenCalled();
    
    unmount();
    
    // Verify cleanup was called
    expect(clearInterval).toHaveBeenCalled();
  });

  it('should not create multiple timers', () => {
    const { rerender } = renderHook(
      ({ active }) => useActiveTimer(active),
      { initialProps: { active: true } }
    );

    // Rerender multiple times
    rerender({ active: true });
    rerender({ active: true });

    // Should only create one timer
    expect(setInterval).toHaveBeenCalledTimes(1);
  });
});
```

### Performance Testing
- Monitor memory usage over 30+ minutes
- Test with multiple active timers
- Verify CPU usage remains stable
- Test on mobile devices for battery impact

## Browser Compatibility

The proposed solution uses standard React hooks and Web APIs:
- ✅ `setInterval/clearInterval` - Universal support
- ✅ `useEffect/useCallback/useRef` - React 16.8+
- ✅ `NodeJS.Timeout` typing - TypeScript compatibility

## Performance Impact

### Before Fix
- Memory usage increases over time
- Multiple active timers consume CPU
- Potential application crashes

### After Fix
- Constant memory usage
- Single timer per active todo
- Predictable performance characteristics
- Proper resource cleanup

## Dependencies

- Should be implemented after ISSUE-001 (TypeScript fixes)
- Can be implemented alongside ISSUE-003 (testing)

## Definition of Done

- Memory leak eliminated - confirmed by browser dev tools
- Single timer instance per component verified
- Proper cleanup on unmount tested
- Performance stable over extended usage
- All existing functionality preserved
- Tests added and passing
- Code review completed and approved
- No regressions in timer functionality