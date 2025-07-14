# Todo Implementation Program

Structured workflow for implementing items from `spec/todo.md`. Work isolation in `spec/todos/work/`, completion tracking in `spec/todos/done/`. Enables concurrent work.

**CRITICAL**: Follow all steps in the workflow! Do not miss executing any steps!

## Inputs

**spec/todo.md** - User's todo list (any format):

```markdown
- Add dark mode toggle to settings
  - Should persist across sessions
  - Use system preference as default

Fix memory leak in WebSocket handler
See issue #123
```

**spec/project-description.md** - Project context and commands (auto-generated, user-editable):

```markdown
# Project: Claude Code notifications

Shows system notifications when Claude Code sessions need user input.
TypeScript/Swift CLI tool with macOS daemon.

## Features

- System tray notifications
- Session monitoring
- macOS integration

## Commands

- **Check**: `npm run check`
- **Test**: `npm test`
- **Build**: `npm run build`

## Structure

src/cli.ts # CLI entry
src/mac/daemon.swift # Menu bar app
src/notifications.ts # Core logic
```

## State

**spec/todos/work/[task-name]/task.md** - Active work in dedicated folders:

```markdown
# [Todo title]

**Status:** Refining -> In Progress -> Done
**Started:** [timestamp]
**Agent PID:** [actual number from running Bash tool: echo $PPID]

## Description

[Refined description]

## Implementation Plan

- [ ] Code change with location(s) (src/file.ts:45-93)
- [ ] ... (multiple code change steps)
- [ ] Automated test: ...
- [ ] ... (multiple automated tests)
- [ ] User test: ...
- [ ] ... (multiple user tests)

## Notes

[Important findings during implementation]
```

## Output

**project-description.md** - On first run, or any time the user asks to regenerate it
**spec/todos/done/[task-name].md** - Completed task with history + commit link
**Git commits** - One commit per task with descriptive message
**Updated todo.md** - Completed items removed

## Workflow

### Phase 0: SETUP

1. **Read todos**: Read spec/todo.md in full using Read tool

   - If does not exist: STOP and tell user no spec/todo.md exists

2. **Read project description**: Read spec/project-description.md in full using Read tool

   - If project description is missing\*\*, create it:
     - Use parallel Task agents to analyze the codebase:
     - Detect language, framework, and build tools
     - Map directory structure and key files
     - Find entry points (main, index, app files)
     - Identify key features and functionality
     - Locate test files and test commands
     - Extract available commands from package.json/Makefile/etc
     - Present proposed project-description.md content to user
     - STOP: "Does this project description look correct? Any corrections needed?"
     - Write confirmed content to spec/project-description.md
     - Read spec/project-description.md in full using Read tool

3. **Ensure directory structure and check for existing tasks**:
   - Create directories and find all existing tasks:
     ```bash
     mkdir -p spec spec/todos/work spec/todos/done && orphaned_count=0 && active_count=0 && for d in spec/todos/work/*/task.md; do [ -f "$d" ] || continue; pid=$(grep "^**Agent PID:" "$d" | cut -d' ' -f3); task_name=$(basename $(dirname "$d")); task_title=$(head -1 "$d" | sed 's/^# //'); if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then active_count=$((active_count + 1)); echo "ACTIVE $active_count. $task_name: $task_title"; else orphaned_count=$((orphaned_count + 1)); echo "ORPHANED $orphaned_count. $task_name: $task_title"; fi; done
     ```
   - If existing tasks found (orphaned or active),
     - Present tasks to the user as numbered lists grouped by type (the user can not see the Bash tool outputs in full!)
     - STOP: "Found existing task(s). What would you like to do? (resume <type:number|name> / reset <type:number|name> / ignore all / new)"
     - **resume <type:number>** (e.g., "resume active:1" or "resume orphaned:2"):
       - Get task name from the specified list (active or orphaned)
       - Read task.md, check Status field
       - Update **Agent PID:** with current agent PID (Bash tool: echo $PPID) if resuming orphaned task
       - If "Refining": Continue from Phase 2 where it left off
       - If "In Progress": Continue from Phase 3, step 1 (Update task.md)
     - **reset <type:number>**:
       - Get task name from the specified list
       - Read spec/todos/work/[task-name]/task.md in full, add it back to spec/todo.md
       - Delete spec/todos/work/[task-name]/
       - Continue to Phase 1
     - **ignore all**: Continue to Phase 1 (leaves all existing tasks as-is)
     - **new**: Continue to Phase 1 (start a new task from spec/todo.md)

### Phase 1: SELECT

1. **Present todos**: Present numbered one-line summaries of each todo to user

2. **Get user selection**:

   - STOP:
     - If no todos: "No todos found in spec/todo.md"
     - Otherwise: "Which todo would you like to work on? (enter number)"

3. **Initialize work folder**:

   - Use parallel tools calls:
     - Generate task folder name
       - Get the date: `date +%Y-%m-%d-%H-%M-%S`
       - Create unique task folder name with format: `[date]-brief-task-title`
       - Example: `2025-01-06-14-30-45-add-dark-mode-toggle`
     - Get agent-pid by running Bash tool:
       ```bash
       echo $PPID
       ```
   - Use parallel tool calls:

     - Create spec/todos/work/[task-folder-name]/ directory
     - Create spec/todos/work/[task-folder-name]/task.md with:

       ```markdown
       # [Original todo text]

       **Status:** Refining
       **Created:** [timestamp]
       **Agent PID:** [agent-pid]

       ## Original Todo

       [Full original todo including any sub-items]
       ```

     - Remove selected todo from spec/todo.md

### Phase 2: REFINE

1. **Refine Description (WHAT)**:

   - Use parallel Task agents to understand current functionality:
     - "What does the app currently do regarding [feature/bug area]?"
     - "What existing features might be related?"
   - Ask clarifying questions based on findings
   - Present description to the user
   - STOP: "Use this description? (y/n)"

2. **Define implementation plan (HOW)**:

   - Use parallel Task agents to investigate:
     - Where in the codebase changes are needed
     - What patterns/structures exist
     - Which files need modification
   - Ask clarifying questions based on findings
   - Present implementation plan to user
     - Code modifications steps: "- [ ] ... (src/file.ts:90-102)"
     - Automated test steps: "- [ ] Automated test: ..."
     - User test steps: "- [ ] User test: ..."
   - STOP: "Use this implementation plan? (y/n)"

3. **Final confirmation**:
   - Present the full task.md content to user
   - STOP: "Use this description and implementation plan? (y/n)"
   - If confirmed
     - Update task.md with refined Description and Implementation Plan sections
     - Commit task.md with message: "Refined plan for: [task-name]"

### Phase 3: IMPLEMENT

1. **Update task.md**:

   - Using one Update tool call
     - Set **Status:** "In Progress"
     - Add **Started:** [ISO timestamp]

2. **Execute implementation plan**:

   - Work through checkboxes sequentially until user tests
   - Update checkbox to [x] as completed
   - Add new steps if discovered
   - Capture important findings in Notes in task.md
   - Consider periodic commits of task.md to save progress (can amend later)

3. **Run checks** after changes:

   - First run checks/validation: Lint, Format, Compile/Build/Typecheck
   - Then run automated tests if any
   - Fix any issues before continuing

4. **Present user test steps** from implementation plan

5. STOP: "Please run the user tests presented above. Do all tests pass? (y/n)"

   - If no: Gather information user on what failed and return to step 2 to fix issues

6. **Check if project description needs updating**:
   - If implementation changed structure, features, or commands:
     - Present proposed updates to spec/project-description.md
     - STOP: "Update project description as shown? (y/n)"
     - If yes, update spec/project-description.md

### Phase 4: COMPLETE

1. **Show changes** for review (open git diff for each changed file via single mcp**vs-claude**open call)

2. STOP: "Ready to commit all changes? (y/n)"

3. **If approved**:

   - Move task to done and cleanup:
     ```bash
     mv spec/todos/work/[task-name]/task.md spec/todos/done/[task-name].md && \
     if [ -z "$(ls -A spec/todos/work/[task-name]/)" ]; then \
         rmdir spec/todos/work/[task-name]/ && echo "Work directory cleaned up"; \
     else \
         echo "Work directory contains additional files, left for manual cleanup"; \
     fi
     ```
   - STOP: "Task complete! Please review git status. Ready to commit and push? (y\n)"
   - **If approved**:
   - Commit staged changes with descriptive one-line message
   - Push

4. STOP: "Task complete! Continue with next todo? (y/n)"
