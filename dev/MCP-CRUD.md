# MCP CRUD Operations Test Examples

This document provides comprehensive examples to verify all CRUD operations work through MCP tools in the eddoapp todo application.

## CREATE Operations

### Basic Todo Creation

```bash
# Create a simple todo
pnpm test:mcp createTodo '{"title": "Test MCP Create", "context": "work", "due": "2025-06-20"}'

# Create a todo with all optional fields
pnpm test:mcp createTodo '{"title": "Complex Todo", "context": "private", "due": "2025-06-25", "description": "Detailed description", "link": "https://example.com", "repeat": 7, "tags": ["urgent", "project"]}'

# Create multiple todos to test batch operations
pnpm test:mcp createTodo '{"title": "Todo 1", "context": "work", "due": "2025-06-19"}'
pnpm test:mcp createTodo '{"title": "Todo 2", "context": "private", "due": "2025-06-21"}'
```

## READ Operations

### Query and Filtering

```bash
# List all todos
pnpm test:mcp listTodos '{}'

# Filter by context
pnpm test:mcp listTodos '{"context": "work"}'

# Filter by completion status
pnpm test:mcp listTodos '{"completed": false}'

# Filter by date range
pnpm test:mcp listTodos '{"startDate": "2025-06-18", "endDate": "2025-06-25"}'

# Limit results
pnpm test:mcp listTodos '{"limit": 5}'

# Complex filtering
pnpm test:mcp listTodos '{"context": "work", "completed": false, "startDate": "2025-06-18", "limit": 10}'

# Check active time tracking
pnpm test:mcp getActiveTimeTracking '{}'
```

## UPDATE Operations

### Todo Modifications

```bash
# Update todo title and description
pnpm test:mcp updateTodo '{"id": "2025-06-18T10:30:00.000Z", "updates": {"title": "Updated Title", "description": "New description"}}'

# Update context and due date
pnpm test:mcp updateTodo '{"id": "2025-06-18T10:30:00.000Z", "updates": {"context": "private", "due": "2025-06-30"}}'

# Add/update tags and link
pnpm test:mcp updateTodo '{"id": "2025-06-18T10:30:00.000Z", "updates": {"tags": ["updated", "mcp-test"], "link": "https://updated-link.com"}}'

# Toggle completion status
pnpm test:mcp toggleTodoCompletion '{"id": "2025-06-18T10:30:00.000Z"}'

# Toggle completion back
pnpm test:mcp toggleTodoCompletion '{"id": "2025-06-18T10:30:00.000Z"}'
```

## DELETE Operations

### Todo Removal

```bash
# Delete a specific todo
pnpm test:mcp deleteTodo '{"id": "2025-06-18T10:30:00.000Z"}'

# Verify deletion by trying to read
pnpm test:mcp listTodos '{"context": "work"}'
```

## TIME TRACKING Operations

### Start/Stop Time Tracking

```bash
# Start time tracking on a todo
pnpm test:mcp startTimeTracking '{"id": "2025-06-18T10:30:00.000Z", "category": "development"}'

# Check active time tracking
pnpm test:mcp getActiveTimeTracking '{}'

# Stop time tracking
pnpm test:mcp stopTimeTracking '{"id": "2025-06-18T10:30:00.000Z", "category": "development"}'

# Start multiple tracking sessions
pnpm test:mcp startTimeTracking '{"id": "2025-06-18T10:30:00.000Z", "category": "research"}'
pnpm test:mcp startTimeTracking '{"id": "2025-06-18T10:30:00.000Z", "category": "testing"}'
```

## ANALYTICS Operations

### Tag Statistics

```bash
# Get tag usage statistics
pnpm test:mcp getServerInfo '{"section": "tagstats"}'

# Create todos with tags for testing
pnpm test:mcp createTodo '{"title": "Analytics Example", "context": "work", "due": "2025-06-26", "tags": ["analytics", "mcp", "testing"]}'

# Get server information (includes tag stats in "all" section)
pnpm test:mcp getServerInfo '{"section": "all"}'
```

## ERROR HANDLING Tests

### Invalid Input Testing

```bash
# Test invalid todo ID
pnpm test:mcp updateTodo '{"id": "invalid-id", "updates": {"title": "Should fail"}}'

# Test missing required fields
pnpm test:mcp createTodo '{"context": "work"}'  # Missing title

# Test invalid context
pnpm test:mcp createTodo '{"title": "Test", "context": "invalid-context", "due": "2025-06-20"}'

# Test invalid date format
pnpm test:mcp createTodo '{"title": "Test", "context": "work", "due": "invalid-date"}'
```

## INTEGRATION Test Sequence

### Full CRUD Lifecycle

```bash
# Full CRUD lifecycle test
# 1. Create
TODO_ID=$(pnpm test:mcp createTodo '{"title": "Integration Test", "context": "work", "due": "2025-06-20"}' | jq -r '.id')

# 2. Read and verify
pnpm test:mcp listTodos '{"context": "work"}'

# 3. Update
pnpm test:mcp updateTodo "{\"id\": \"$TODO_ID\", \"updates\": {\"description\": \"Updated via MCP\"}}"

# 4. Start/stop time tracking
pnpm test:mcp startTimeTracking "{\"id\": \"$TODO_ID\", \"category\": \"testing\"}"
pnpm test:mcp stopTimeTracking "{\"id\": \"$TODO_ID\", \"category\": \"testing\"}"

# 5. Complete
pnpm test:mcp toggleTodoCompletion "{\"id\": \"$TODO_ID\"}"

# 6. Delete
pnpm test:mcp deleteTodo "{\"id\": \"$TODO_ID\"}"

# 7. Verify deletion
pnpm test:mcp listTodos '{"context": "work"}'
```

## Available MCP Tools

The application exposes these MCP tools for CRUD operations:

1. **CREATE**: `createTodo` - Creates new todo items with full schema validation
2. **READ**:
   - `listTodos` - Lists todos with filtering by context, completion status, date range, and limits
   - `getActiveTimeTracking` - Queries todos with active time tracking
3. **UPDATE**:
   - `updateTodo` - Updates existing todo properties
   - `toggleTodoCompletion` - Handles completion status and repeating todos
4. **DELETE**: `deleteTodo` - Permanently removes todos
5. **TIME TRACKING**:
   - `startTimeTracking` - Begins time tracking for a todo
   - `stopTimeTracking` - Ends time tracking sessions
6. **ANALYTICS**:
   - `getServerInfo` - Provides server information and analytics (use `"section": "tagstats"` for tag statistics)

## Data Model (Alpha3)

```typescript
interface TodoAlpha3 {
  _id: string; // ISO timestamp of creation
  active: Record<string, string | null>; // Time tracking entries
  completed: string | null;
  context: string; // GTD context
  description: string;
  due: string; // ISO date string
  link: string | null; // Added in alpha3
  repeat: number | null; // Days
  tags: string[];
  title: string;
  version: 'alpha3';
}
```

## Notes

- The MCP server connects to CouchDB using environment configuration (default: `http://admin:password@localhost:5984`)
- Database name is configurable via `COUCHDB_DB_NAME` environment variable (default: `todos-dev`)
- All operations include comprehensive error handling and input validation via Zod schemas
- Time tracking supports multiple concurrent categories per todo
- Repeating todos automatically create new instances when completed
