# Todo Continue Command

Resume work on existing todo tasks from `spec/todos/work/`. Finds in-progress tasks, allows user selection, and continues the workflow from the appropriate phase.

**CRITICAL**: Follow all steps in the workflow! Do not miss executing any steps!

## Workflow

### Phase 0: DISCOVER

1. **Scan for existing tasks**:
   - Find all task folders in `spec/todos/work/`:
     ```bash
     find spec/todos/work -name "task.md" -type f 2>/dev/null | sort
     ```

2. **Parse task information**:
   - For each task.md found:
     - Extract task title (first line without `# `)
     - Extract status from `**Status:**` line
     - Extract task folder name from path
   
3. **Present available tasks**:
   - If no tasks found: STOP "No existing tasks found in spec/todos/work/"
   - Otherwise: Present numbered list with format: "number. [status] task-title"
   - STOP: "Which task would you like to continue? (enter number)"

### Phase 1: RESUME

1. **Get user selection and validate**:
   - Get task folder name from numbered list
   - Verify task.md still exists

2. **Update agent ownership**:
   - Get current agent PID: `echo $PPID`
   - Update **Agent PID:** field in task.md

3. **Determine resume point based on status**:
   - **Status: "Refining"**: Continue from todo.md Phase 2 (REFINE) 
   - **Status: "In Progress"**: Continue from todo.md Phase 3 (IMPLEMENT)
   - **Any other status**: STOP "Unknown status: [status]. Cannot resume."

### Phase 2: CONTINUE WORKFLOW

1. **Follow todo.md workflow**: Execute the appropriate phase from the original todo.md workflow based on the task status

2. **Maintain task.md**: Update task.md throughout the process as specified in the original workflow

3. **Complete normally**: Follow through to Phase 4 (COMPLETE) of the original workflow when finished