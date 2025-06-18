# ISSUE-008: Add Input Validation and XSS Prevention

**Priority:** High  
**Category:** Security  
**Estimated Effort:** 2-3 days  
**Impact:** High - Prevents XSS attacks and data corruption  

## Description

The application currently lacks proper input validation and sanitization, making it vulnerable to XSS attacks and data corruption. User inputs are directly stored and rendered without validation, creating security risks and potential data integrity issues.

## Current Security Vulnerabilities

### Missing Validation
- **Todo titles and descriptions:** No length limits or content validation
- **Context names:** Can contain potentially dangerous characters
- **Link fields:** No URL validation or sanitization
- **Date inputs:** No format validation beyond HTML5 constraints
- **Tag inputs:** No validation or sanitization

### XSS Attack Vectors
```typescript
// Current vulnerable patterns
<div>{todo.title}</div>  // ❌ Direct rendering without sanitization
<input value={userInput} />  // ❌ No input validation
```

### Potential Attack Examples
```javascript
// Malicious inputs that could cause issues
const maliciousTitle = "<img src=x onerror=alert('XSS')>";
const maliciousLink = "javascript:alert('XSS')";
const maliciousContext = "<script>stealData()</script>";
```

## Implementation Strategy

### 1. Input Validation Library
Use a combination of validation libraries:
```typescript
// Add validation dependencies
npm install zod dompurify
npm install -D @types/dompurify
```

### 2. Schema-Based Validation with Zod
```typescript
// src/schemas/todo_validation.ts
import { z } from 'zod';

export const TodoSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .refine(title => !/<script/i.test(title), 'Invalid characters in title'),
  
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  
  context: z.string()
    .min(1, 'Context is required')
    .max(50, 'Context must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s-_]+$/, 'Context contains invalid characters'),
  
  due: z.string()
    .refine(date => !isNaN(Date.parse(date)), 'Invalid date format'),
  
  link: z.string()
    .url('Invalid URL format')
    .refine(url => !url.startsWith('javascript:'), 'JavaScript URLs not allowed')
    .optional()
    .or(z.literal('')),
  
  tags: z.array(z.string().max(30)).max(10, 'Maximum 10 tags allowed')
});

export type ValidatedTodo = z.infer<typeof TodoSchema>;
```

### 3. Content Sanitization
```typescript
// src/utils/sanitize.ts
import DOMPurify from 'dompurify';

export function sanitizeHtml(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: []
  });
}

export function sanitizeUrl(url: string): string {
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  
  if (dangerousProtocols.some(protocol => 
    url.toLowerCase().startsWith(protocol))) {
    return '';
  }
  
  return DOMPurify.sanitize(url);
}

export function validateAndSanitizeTodo(input: unknown): ValidatedTodo {
  // First validate with Zod
  const validatedTodo = TodoSchema.parse(input);
  
  // Then sanitize the content
  return {
    ...validatedTodo,
    title: sanitizeHtml(validatedTodo.title),
    description: validatedTodo.description ? 
      sanitizeHtml(validatedTodo.description) : undefined,
    context: sanitizeHtml(validatedTodo.context),
    link: validatedTodo.link ? sanitizeUrl(validatedTodo.link) : undefined,
    tags: validatedTodo.tags.map(tag => sanitizeHtml(tag))
  };
}
```

## Acceptance Criteria

- [ ] All user inputs validated before processing
- [ ] XSS prevention implemented for all text inputs
- [ ] URL validation prevents javascript: and dangerous protocols
- [ ] Input length limits enforced
- [ ] Error messages displayed for invalid inputs
- [ ] Sanitization preserves legitimate user content
- [ ] Form validation works in real-time
- [ ] Backend validation prevents bypassing client-side checks

## Implementation Plan

### Phase 1: Core Validation Infrastructure (Day 1)

1. **Install and configure validation libraries**
   ```bash
   pnpm add zod dompurify
   pnpm add -D @types/dompurify
   ```

2. **Create validation schemas**
   - `src/schemas/todo_validation.ts`
   - `src/schemas/context_validation.ts`
   - Export all schemas from index file

3. **Create sanitization utilities**
   - `src/utils/sanitize.ts`
   - `src/utils/validate.ts`
   - Add comprehensive tests

### Phase 2: Form Validation Integration (Day 1-2)

4. **Update AddTodo component**
   ```typescript
   // src/components/add_todo.tsx
   function AddTodo() {
     const [errors, setErrors] = useState<ZodError | null>(null);
     
     const handleSubmit = async (event: React.FormEvent) => {
       event.preventDefault();
       
       try {
         const validatedTodo = validateAndSanitizeTodo({
           title: todoTitle,
           context: todoContext,
           due: todoDue,
           link: todoLink
         });
         
         await addTodo(validatedTodo);
         setErrors(null);
         // Reset form
       } catch (error) {
         if (error instanceof ZodError) {
           setErrors(error);
         }
       }
     };
     
     return (
       <form onSubmit={handleSubmit}>
         <input 
           value={todoTitle}
           onChange={(e) => setTodoTitle(e.target.value)}
           className={errors?.issues.find(i => i.path.includes('title')) ? 
             'border-red-500' : ''}
         />
         {errors?.issues
           .filter(i => i.path.includes('title'))
           .map(error => (
             <p key={error.message} className="text-red-500 text-sm">
               {error.message}
             </p>
           ))
         }
       </form>
     );
   }
   ```

5. **Add real-time validation**
   ```typescript
   // Debounced validation during typing
   const [validationErrors, setValidationErrors] = useState<ZodError | null>(null);
   
   const validateInput = useMemo(
     () => debounce((value: string, field: string) => {
       try {
         TodoSchema.pick({ [field]: true }).parse({ [field]: value });
         setValidationErrors(prev => 
           prev ? prev.issues.filter(i => !i.path.includes(field)) : null
         );
       } catch (error) {
         if (error instanceof ZodError) {
           setValidationErrors(error);
         }
       }
     }, 300),
     []
   );
   ```

### Phase 3: Display and Storage Validation (Day 2-3)

6. **Secure todo display**
   ```typescript
   // Safe rendering with validation
   function TodoDisplay({ todo }: { todo: Todo }) {
     const safeTodo = useMemo(() => {
       try {
         return validateAndSanitizeTodo(todo);
       } catch {
         // Fallback for corrupted data
         return {
           ...todo,
           title: sanitizeHtml(todo.title || 'Corrupted Todo'),
           description: todo.description ? sanitizeHtml(todo.description) : undefined
         };
       }
     }, [todo]);
     
     return (
       <div>
         <h3>{safeTodo.title}</h3>
         {safeTodo.description && <p>{safeTodo.description}</p>}
         {safeTodo.link && (
           <a 
             href={safeTodo.link} 
             target="_blank" 
             rel="noopener noreferrer"
           >
             {safeTodo.link}
           </a>
         )}
       </div>
     );
   }
   ```

7. **Database validation layer**
   ```typescript
   // src/api/todo_operations.ts
   export async function createTodo(todoData: unknown): Promise<Todo> {
     const validatedTodo = validateAndSanitizeTodo(todoData);
     
     const todo: TodoAlpha3 = {
       _id: new Date().toISOString(),
       ...validatedTodo,
       active: {},
       completed: null,
       repeat: null,
       tags: validatedTodo.tags || [],
       version: 'alpha3'
     };
     
     await db.put(todo);
     return todo;
   }
   ```

## Validation Rules Implementation

### Text Content Validation
```typescript
const TextValidation = {
  title: {
    minLength: 1,
    maxLength: 200,
    pattern: /^[^<>]*$/, // No angle brackets
  },
  description: {
    maxLength: 1000,
    pattern: /^[^<>]*$/, // No angle brackets
  },
  context: {
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9\s\-_]+$/, // Alphanumeric, spaces, hyphens, underscores
  }
};
```

### URL Validation
```typescript
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

### Date Validation
```typescript
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0];
}
```

## Security Testing

### XSS Prevention Tests
```typescript
describe('XSS Prevention', () => {
  const xssPayloads = [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert('xss')>",
    "javascript:alert('xss')",
    "<svg onload=alert('xss')>",
    "';alert('xss');//"
  ];

  xssPayloads.forEach(payload => {
    it(`should sanitize XSS payload: ${payload}`, () => {
      expect(() => {
        validateAndSanitizeTodo({
          title: payload,
          context: 'test',
          due: '2025-06-18'
        });
      }).not.toThrow();
      
      const result = validateAndSanitizeTodo({
        title: payload,
        context: 'test',
        due: '2025-06-18'
      });
      
      expect(result.title).not.toContain('<script');
      expect(result.title).not.toContain('javascript:');
    });
  });
});
```

### Input Validation Tests
```typescript
describe('Input Validation', () => {
  it('should reject empty titles', () => {
    expect(() => {
      TodoSchema.parse({ title: '', context: 'test', due: '2025-06-18' });
    }).toThrow();
  });

  it('should reject overly long titles', () => {
    const longTitle = 'a'.repeat(201);
    expect(() => {
      TodoSchema.parse({ title: longTitle, context: 'test', due: '2025-06-18' });
    }).toThrow();
  });

  it('should reject invalid URLs', () => {
    expect(() => {
      TodoSchema.parse({
        title: 'test',
        context: 'test',
        due: '2025-06-18',
        link: 'javascript:alert("evil")'
      });
    }).toThrow();
  });
});
```

## User Experience Considerations

### Error Display
- Clear, actionable error messages
- Real-time validation feedback
- Visual indicators for invalid fields
- Preserve valid input when showing errors

### Performance
- Debounced validation to avoid excessive checking
- Efficient sanitization that doesn't impact typing
- Minimal impact on form submission speed

## Dependencies

- Should be implemented after ISSUE-001 (TypeScript fixes)
- Works well with ISSUE-005 (CSP) for comprehensive security
- Benefits from ISSUE-003 (testing) for validation test coverage

## Definition of Done

- All user inputs validated with Zod schemas
- XSS prevention implemented and tested
- Form validation provides clear user feedback
- Real-time validation works without performance issues
- Dangerous URLs blocked (javascript:, data:, etc.)
- Input length limits enforced
- Comprehensive test coverage for all validation rules
- No XSS vulnerabilities found in security audit
- Documentation updated with validation patterns