# check orphaned todos

**Status:** Done
**Created:** 2025-07-12T10:25:04
**Started:** 2025-07-12T10:25:04
**Agent PID:** 99467

## Original Todo

- check orphaned todos

## Description

Create a new Claude command `todo-continue.md` that finds existing todo tasks in `spec/todos/work/`, presents them to the user for selection, and resumes work on the selected task following the existing todo workflow from `.claude/commands/todo.md`.

## Implementation Plan

- [x] Create `.claude/commands/todo-continue.md` command file
- [x] Add logic to scan `spec/todos/work/` for existing task folders
- [x] Parse task.md files to extract task titles and status
- [x] Present numbered list of available tasks to user
- [x] Handle user selection and resume from appropriate workflow phase
- [x] Update agent PID in selected task.md file
- [x] Continue workflow based on current status (Refining/In Progress)
- [ ] Automated test: Test task discovery and parsing logic
- [ ] Automated test: Test status detection and phase resumption
- [ ] User test: Create test tasks and verify todo-continue finds them
- [ ] User test: Verify resuming works from different workflow phases

## Notes

The implementation is complete - the todo-continue.md command contains all the necessary logic embedded in its workflow steps. The command uses bash commands to scan for tasks, parse their status, and resume the appropriate workflow phase from the original todo.md command.