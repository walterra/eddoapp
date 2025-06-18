# ISSUE-003: Implement Comprehensive Component Test Suite

**Priority:** Critical  
**Category:** Testing  
**Estimated Effort:** 1-2 weeks  
**Impact:** High - No component test coverage currently exists  

## Description

The project currently has zero component tests, with only utility functions tested. This creates significant risk for regressions and makes refactoring dangerous. A comprehensive component test suite is needed.

## Current Testing Gap

### Components Without Tests
- `TodoBoard` (main component with complex logic)
- `AddTodo` (form handling and validation)
- `TodoListElement` (todo item rendering and interactions)
- All time tracking components
- Modal components
- Calendar/date components

### Utilities Already Tested ✅
- `get_active_duration.test.ts`
- `get_active_record_for_todos.test.ts` 
- `get_formatted_duration.test.ts`

## Testing Strategy

### Component Testing Approach
- **Unit Tests:** Individual component behavior
- **Integration Tests:** Component interactions with PouchDB
- **Accessibility Tests:** Screen reader and keyboard navigation
- **Visual Regression Tests:** Consider adding in future

### Testing Tools
- **Vitest** (already configured)
- **React Testing Library** (needs to be added)
- **@testing-library/jest-dom** (for additional matchers)
- **@testing-library/user-event** (for user interactions)

## Acceptance Criteria

- [ ] All major components have comprehensive tests
- [ ] Test coverage ≥ 80% for component code
- [ ] Integration tests for PouchDB interactions
- [ ] Accessibility tests for form components
- [ ] Error boundary testing
- [ ] Loading state testing
- [ ] User interaction testing (clicks, form submissions, etc.)

## Implementation Plan

### Phase 1: Setup and Core Components (Week 1)

1. **Add testing dependencies**
   ```bash
   pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
   ```

2. **Configure test setup**
   - Create `src/test-setup.ts`
   - Configure Vitest with React Testing Library
   - Set up PouchDB mocks

3. **Test TodoBoard component**
   - Rendering with different props
   - Todo filtering and grouping
   - Time tracking functionality
   - Database interaction mocking

4. **Test AddTodo component**
   - Form validation
   - Submission handling
   - Error states
   - Input validation

### Phase 2: Interactive Components (Week 2)

5. **Test TodoListElement component**
   - Todo display rendering
   - Time tracking controls
   - Edit/delete actions
   - Status changes

6. **Test modal components**
   - Open/close behavior
   - Form handling within modals
   - Keyboard navigation
   - Focus management

7. **Test time tracking components**
   - Start/stop functionality
   - Duration calculations
   - Active state management

## Test Structure Example

```typescript
// Example test structure for AddTodo component
describe('AddTodo', () => {
  beforeEach(() => {
    // Mock PouchDB
    vi.mock('../pouch_db', () => ({
      usePouchDb: () => mockDb
    }));
  });

  it('should render form elements correctly', () => {
    render(<AddTodo />);
    expect(screen.getByLabelText('New todo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    const user = userEvent.setup();
    render(<AddTodo />);
    
    await user.type(screen.getByLabelText('New todo'), 'Test todo');
    await user.click(screen.getByRole('button', { name: /add/i }));
    
    expect(mockDb.put).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test todo'
      })
    );
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    render(<AddTodo />);
    
    await user.click(screen.getByRole('button', { name: /add/i }));
    
    // Should not submit with empty title
    expect(mockDb.put).not.toHaveBeenCalled();
  });
});
```

## Mock Strategy

### PouchDB Mocking
```typescript
// Mock PouchDB for consistent testing
const mockDb = {
  put: vi.fn(),
  get: vi.fn(),
  allDocs: vi.fn(),
  changes: vi.fn(() => ({
    on: vi.fn(),
    cancel: vi.fn()
  }))
};
```

### Date/Time Mocking
```typescript
// Mock dates for time tracking tests
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-06-18T10:00:00.000Z'));
});
```

## Testing Requirements

### Unit Tests
- [ ] Component rendering with various props
- [ ] Event handler testing
- [ ] State management testing
- [ ] Error handling testing

### Integration Tests  
- [ ] PouchDB read/write operations
- [ ] Component interaction flows
- [ ] Real-time updates via changes feed

### Accessibility Tests
- [ ] Keyboard navigation
- [ ] Screen reader compatibility  
- [ ] ARIA label correctness
- [ ] Focus management

## Coverage Requirements

- **Minimum Coverage:** 80% for component files
- **Exclude from Coverage:** Test files, type definitions, constants
- **Coverage Reporting:** Add to CI/CD pipeline

## Dependencies

- ISSUE-001: Fix TypeScript compilation (needed for clean test runs)
- ISSUE-002: Update dependencies (for latest testing library versions)

## Definition of Done

- All major components have comprehensive test suites
- Test coverage meets minimum threshold (80%)
- Tests run successfully in CI/CD pipeline
- Test documentation added to project docs
- Mock strategy documented for future contributors
- All tests pass consistently