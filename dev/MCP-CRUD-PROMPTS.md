# MCP CRUD Operations - Natural Language Prompts

This document contains natural language prompts that would trigger the corresponding MCP actions in the eddoapp todo application.

## CREATE Operations

### Basic Todo Creation
```
Create a new todo called "Test MCP Create" for work context due June 20th, 2025

Create a complex todo titled "Complex Todo" in private context due June 25th, 2025 with description "Detailed description", link "https://example.com", repeating every 7 days, and tags "urgent" and "project"

Create multiple todos:
- "Todo 1" for work due June 19th, 2025
- "Todo 2" for private due June 21st, 2025
```

## READ Operations

### Query and Filtering
```
Show me all my todos

List all todos in work context

Show me all incomplete todos

Show todos due between June 18th and June 25th, 2025

Show me the first 5 todos

Show me incomplete work todos from June 18th onwards, limit to 10 results

Which todos currently have active time tracking?
```

## UPDATE Operations

### Todo Modifications
```
Update the todo "Test MCP Create" to have title "Updated Title" and description "New description"

Change the todo "Complex Todo" to private context and due date June 30th, 2025

Add tags "updated" and "mcp-test" to todo "Test MCP Create" and set its link to "https://updated-link.com"

Mark todo "Test MCP Create" as completed

Mark todo "Updated Title" as incomplete again
```

## DELETE Operations

### Todo Removal
```
Delete the todo "Test MCP Create"

Remove todo "Complex Todo" and then show me remaining work todos
```

## TIME TRACKING Operations

### Start/Stop Time Tracking
```
Start tracking time on todo "Test MCP Create" under "development" category

Show me which todos have active time tracking

Stop time tracking for "development" category on todo "Test MCP Create"

Start time tracking on todo "Complex Todo" for both "research" and "testing" categories
```

## ERROR HANDLING Tests

### Invalid Input Testing
```
Try to update a todo called "Nonexistent Todo" to title "Should fail"

Create a todo for work context without specifying a title

Create a todo called "Test" with invalid context "invalid-context" due June 20th, 2025

Create a todo called "Test" for work with invalid due date "invalid-date"
```

## INTEGRATION Test Sequence

### Full CRUD Lifecycle
```
Create a new todo called "Integration Test" for work due June 20th, 2025, then:
1. Show me all work todos to verify it was created
2. Update its description to "Updated via MCP"
3. Start time tracking under "testing" category
4. Stop the time tracking
5. Mark it as completed
6. Delete the todo
7. Verify it's gone by showing work todos
```

## Available Natural Language Triggers

The application responds to these types of natural language requests:

1. **CREATE**: "Create a todo...", "Add a new task...", "Make a todo..."
2. **READ**: 
   - "Show me todos...", "List all...", "What todos do I have..."
   - "Which todos are being tracked?", "Show active time tracking"
3. **UPDATE**: 
   - "Update todo...", "Change the todo...", "Modify..."
   - "Mark as complete", "Mark as done", "Complete this todo"
4. **DELETE**: "Delete todo...", "Remove the todo...", "Get rid of..."
5. **TIME TRACKING**: 
   - "Start tracking time on...", "Begin timing..."
   - "Stop time tracking", "End timer for..."

## Data Context Understanding

The AI assistant understands these todo properties:
- **Title**: The main todo text
- **Context**: GTD-style contexts (work, private, etc.)
- **Due date**: When the todo should be completed
- **Description**: Additional details about the todo
- **Link**: Associated URL or reference
- **Repeat**: How often the todo repeats (in days)
- **Tags**: Categorization labels
- **Completion status**: Whether the todo is done
- **Time tracking**: Active timing sessions by category

## Natural Language Features

- Flexible date parsing ("June 20th", "next Friday", "in 3 days")
- Context inference from keywords ("work meeting" → work context)
- Batch operations ("create these todos...")
- Status queries ("what's due today?", "show overdue items")
- Time tracking management ("start timer", "how long have I been working on this?")