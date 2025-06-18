# ISSUE-010: Add Accessibility Features (Focus Management, ARIA Live Regions)

**Priority:** High  
**Category:** Accessibility  
**Estimated Effort:** 1-2 weeks  
**Impact:** High - Ensures compliance and usability for all users  

## Description

The application currently has basic accessibility support but lacks advanced features like focus management and ARIA live regions. This limits usability for screen reader users and keyboard navigation, potentially violating accessibility standards.

## Current Accessibility Gaps

### Missing Features
- **Focus Management:** No focus trapping in modals
- **ARIA Live Regions:** No announcements for dynamic content changes
- **Keyboard Navigation:** Limited keyboard-only navigation support
- **Focus Indicators:** Inconsistent focus styling
- **Screen Reader Context:** Missing descriptive labels and landmarks
- **Skip Links:** No navigation shortcuts for keyboard users

### Current Accessibility Strengths ✅
- Basic ARIA labels on form inputs
- Semantic HTML structure
- Form submission works with keyboard

## Accessibility Standards Compliance

### Target Standards
- **WCAG 2.1 Level AA** compliance
- **Section 508** compliance for government use
- **ADA** compliance for legal protection

### Key Requirements
- Keyboard navigation for all interactive elements
- Screen reader announcements for state changes
- Focus management in modals and dynamic content
- Color contrast ratios meeting AA standards
- Alternative text for meaningful images

## Implementation Strategy

### 1. Focus Management System
```typescript
// src/hooks/useFocusManagement.ts
export function useFocusManagement() {
  const focusableElementsSelector = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(focusableElementsSelector);
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [focusableElementsSelector]);

  return { trapFocus };
}
```

### 2. ARIA Live Regions
```typescript
// src/hooks/useAnnouncements.ts
type AnnouncementType = 'polite' | 'assertive';

export function useAnnouncements() {
  const announce = useCallback((message: string, type: AnnouncementType = 'polite') => {
    const announcer = document.getElementById(`announcer-${type}`) || 
      createAnnouncer(type);
    
    // Clear previous announcement
    announcer.textContent = '';
    
    // Add new announcement after brief delay
    setTimeout(() => {
      announcer.textContent = message;
    }, 100);
  }, []);

  const announceSuccess = useCallback((message: string) => {
    announce(`Success: ${message}`, 'polite');
  }, [announce]);

  const announceError = useCallback((message: string) => {
    announce(`Error: ${message}`, 'assertive');
  }, [announce]);

  return { announce, announceSuccess, announceError };
}

function createAnnouncer(type: AnnouncementType): HTMLElement {
  const announcer = document.createElement('div');
  announcer.id = `announcer-${type}`;
  announcer.setAttribute('aria-live', type);
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'sr-only';
  document.body.appendChild(announcer);
  return announcer;
}
```

## Acceptance Criteria

- [ ] Focus management works in all modals and dynamic content
- [ ] Screen reader announcements for all state changes
- [ ] Complete keyboard navigation without mouse
- [ ] WCAG 2.1 AA color contrast compliance
- [ ] Skip links for main navigation areas
- [ ] Semantic landmarks for page structure
- [ ] Loading states announced to screen readers
- [ ] Error messages properly associated with form fields
- [ ] Time tracking state changes announced
- [ ] Todo completion/creation announced

## Implementation Plan

### Phase 1: Focus Management (Week 1, Days 1-3)

1. **Create focus management utilities**
   ```typescript
   // src/hooks/useFocusManagement.ts
   // src/hooks/useFocusTrap.ts
   // src/utils/focus.ts
   ```

2. **Implement modal focus trapping**
   ```typescript
   function Modal({ isOpen, onClose, children }: ModalProps) {
     const modalRef = useRef<HTMLDivElement>(null);
     const previousFocusRef = useRef<HTMLElement | null>(null);
     const { trapFocus } = useFocusManagement();

     useEffect(() => {
       if (isOpen && modalRef.current) {
         previousFocusRef.current = document.activeElement as HTMLElement;
         const releaseTrap = trapFocus(modalRef.current);
         
         return () => {
           releaseTrap();
           previousFocusRef.current?.focus();
         };
       }
     }, [isOpen, trapFocus]);

     const handleEscapeKey = useCallback((e: KeyboardEvent) => {
       if (e.key === 'Escape') {
         onClose();
       }
     }, [onClose]);

     useEffect(() => {
       if (isOpen) {
         document.addEventListener('keydown', handleEscapeKey);
         return () => document.removeEventListener('keydown', handleEscapeKey);
       }
     }, [isOpen, handleEscapeKey]);

     if (!isOpen) return null;

     return (
       <div className="modal-overlay" onClick={onClose}>
         <div 
           ref={modalRef}
           className="modal-content"
           onClick={(e) => e.stopPropagation()}
           role="dialog"
           aria-modal="true"
           aria-labelledby="modal-title"
         >
           {children}
         </div>
       </div>
     );
   }
   ```

3. **Add skip links**
   ```typescript
   function SkipLinks() {
     return (
       <div className="skip-links">
         <a 
           href="#main-content" 
           className="skip-link"
           onFocus={(e) => e.currentTarget.classList.add('show')}
           onBlur={(e) => e.currentTarget.classList.remove('show')}
         >
           Skip to main content
         </a>
         <a href="#todo-form" className="skip-link">
           Skip to add todo form
         </a>
       </div>
     );
   }
   ```

### Phase 2: ARIA Live Regions (Week 1, Days 3-5)

4. **Implement announcement system**
   ```typescript
   // Add to main app component
   function App() {
     useEffect(() => {
       // Create ARIA live regions on app load
       createAnnouncer('polite');
       createAnnouncer('assertive');
     }, []);

     return (
       <div>
         <SkipLinks />
         <main id="main-content">
           {/* app content */}
         </main>
       </div>
     );
   }
   ```

5. **Add announcements to todo operations**
   ```typescript
   function AddTodo() {
     const { announceSuccess, announceError } = useAnnouncements();

     const handleSubmit = async (event: React.FormEvent) => {
       event.preventDefault();
       
       try {
         await addTodo(todoData);
         announceSuccess(`Todo "${todoData.title}" added successfully`);
         setTodoTitle(''); // Reset form
       } catch (error) {
         announceError('Failed to add todo. Please try again.');
       }
     };

     // ... rest of component
   }
   ```

6. **Add time tracking announcements**
   ```typescript
   function TimeTrackingButton({ todo }: { todo: Todo }) {
     const { announceSuccess } = useAnnouncements();
     const [isActive, setIsActive] = useState(isTimeActive(todo));

     const handleToggleTime = async () => {
       try {
         if (isActive) {
           await stopTimeTracking(todo._id);
           announceSuccess(`Time tracking stopped for "${todo.title}"`);
         } else {
           await startTimeTracking(todo._id);
           announceSuccess(`Time tracking started for "${todo.title}"`);
         }
         setIsActive(!isActive);
       } catch (error) {
         announceError('Failed to update time tracking');
       }
     };

     return (
       <button 
         onClick={handleToggleTime}
         aria-label={`${isActive ? 'Stop' : 'Start'} time tracking for ${todo.title}`}
       >
         {isActive ? 'Stop' : 'Start'}
       </button>
     );
   }
   ```

### Phase 3: Enhanced Keyboard Navigation (Week 2, Days 1-3)

7. **Implement keyboard shortcuts**
   ```typescript
   // src/hooks/useKeyboardShortcuts.ts
   export function useKeyboardShortcuts() {
     useEffect(() => {
       const handleKeyDown = (e: KeyboardEvent) => {
         // Alt + N: New todo
         if (e.altKey && e.key === 'n') {
           e.preventDefault();
           document.getElementById('new-todo-input')?.focus();
         }
         
         // Alt + S: Search todos
         if (e.altKey && e.key === 's') {
           e.preventDefault();
           document.getElementById('search-input')?.focus();
         }
         
         // Escape: Close modals
         if (e.key === 'Escape') {
           // Handle in individual modal components
         }
       };

       document.addEventListener('keydown', handleKeyDown);
       return () => document.removeEventListener('keydown', handleKeyDown);
     }, []);
   }
   ```

8. **Add roving tabindex for todo lists**
   ```typescript
   function TodoList({ todos }: { todos: Todo[] }) {
     const [focusedIndex, setFocusedIndex] = useState(0);
     const todoRefs = useRef<(HTMLDivElement | null)[]>([]);

     const handleKeyDown = (e: KeyboardEvent, index: number) => {
       switch (e.key) {
         case 'ArrowDown':
           e.preventDefault();
           const nextIndex = Math.min(index + 1, todos.length - 1);
           setFocusedIndex(nextIndex);
           todoRefs.current[nextIndex]?.focus();
           break;
           
         case 'ArrowUp':
           e.preventDefault();
           const prevIndex = Math.max(index - 1, 0);
           setFocusedIndex(prevIndex);
           todoRefs.current[prevIndex]?.focus();
           break;
           
         case 'Enter':
         case ' ':
           e.preventDefault();
           // Toggle todo or open details
           break;
       }
     };

     return (
       <div role="list" aria-label="Todo items">
         {todos.map((todo, index) => (
           <div
             key={todo._id}
             ref={el => todoRefs.current[index] = el}
             role="listitem"
             tabIndex={index === focusedIndex ? 0 : -1}
             onKeyDown={(e) => handleKeyDown(e, index)}
             onFocus={() => setFocusedIndex(index)}
             aria-label={`Todo: ${todo.title}, due ${todo.due}`}
           >
             <TodoListElement todo={todo} />
           </div>
         ))}
       </div>
     );
   }
   ```

### Phase 4: Semantic Structure and ARIA (Week 2, Days 3-5)

9. **Add semantic landmarks**
   ```typescript
   function AppLayout() {
     return (
       <div className="app">
         <header role="banner">
           <h1>Eddo - Todo & Time Tracking</h1>
           <nav role="navigation" aria-label="Main navigation">
             {/* navigation items */}
           </nav>
         </header>
         
         <main role="main" id="main-content">
           <section aria-labelledby="add-todo-heading">
             <h2 id="add-todo-heading" className="sr-only">Add New Todo</h2>
             <AddTodo />
           </section>
           
           <section aria-labelledby="todo-list-heading">
             <h2 id="todo-list-heading">Your Todos</h2>
             <TodoBoard />
           </section>
         </main>
         
         <aside role="complementary" aria-label="Time tracking summary">
           <TimeTrackingSummary />
         </aside>
       </div>
     );
   }
   ```

10. **Enhanced form accessibility**
    ```typescript
    function AddTodo() {
      const [errors, setErrors] = useState<Record<string, string>>({});

      return (
        <form noValidate>
          <div className="form-group">
            <label htmlFor="todo-title">
              Todo Title <span aria-label="required">*</span>
            </label>
            <input
              id="todo-title"
              type="text"
              required
              aria-describedby={errors.title ? 'title-error' : undefined}
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <div 
                id="title-error" 
                role="alert" 
                className="error-message"
              >
                {errors.title}
              </div>
            )}
          </div>
          
          <fieldset>
            <legend>Context</legend>
            <div role="radiogroup" aria-labelledby="context-label">
              <span id="context-label" className="sr-only">Choose context</span>
              {contexts.map(context => (
                <label key={context}>
                  <input 
                    type="radio" 
                    name="context" 
                    value={context}
                    aria-describedby="context-help"
                  />
                  {context}
                </label>
              ))}
            </div>
            <div id="context-help" className="help-text">
              Context helps organize your todos by area of focus
            </div>
          </fieldset>
        </form>
      );
    }
    ```

## Testing Strategy

### Automated Accessibility Testing
```typescript
// Using @testing-library/jest-dom and axe-core
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<TodoBoard />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should trap focus in modal', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Open modal
    await user.click(screen.getByText('Add Todo'));
    
    // Tab through modal elements
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByLabelText('Todo Title'));
    
    // Continue tabbing and verify focus stays within modal
    await user.keyboard('{Tab}');
    await user.keyboard('{Tab}');
    // Should cycle back to first focusable element
  });
});
```

### Manual Testing Checklist
- [ ] Navigate entire app using only keyboard
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] Verify focus indicators are visible
- [ ] Test color contrast with automated tools
- [ ] Verify announcements work correctly
- [ ] Test skip links functionality

## Performance Considerations

### Efficient Focus Management
```typescript
// Debounce focus announcements to avoid spam
const debouncedAnnounce = useMemo(
  () => debounce((message: string) => announce(message), 300),
  [announce]
);
```

### Lazy Loading Accessibility Features
```typescript
// Only load complex a11y features when needed
const { trapFocus } = useFocusManagement();
const shouldTrapFocus = isModalOpen || hasActiveDropdown;
```

## Dependencies

- Works well with ISSUE-004 (error boundaries) for accessible error handling
- Benefits from ISSUE-003 (testing) for accessibility test coverage
- Complements ISSUE-009 (loading states) for accessible loading indicators

## Definition of Done

- All interactive elements accessible via keyboard
- Focus management works in modals and dynamic content
- Screen reader announcements for all state changes
- WCAG 2.1 AA compliance verified with automated tools
- Manual testing with screen readers passes
- Skip links implemented and functional
- Semantic HTML structure with proper landmarks
- Color contrast meets AA standards
- Form validation errors properly announced
- Time tracking state changes announced to assistive technology
- Comprehensive accessibility test coverage
- Documentation updated with accessibility guidelines