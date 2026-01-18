---
name: eddo-work
description: Structured work mode for implementing complex tasks with phases. Use when user says "what next?" followed by "let's work on this" or "start working". Provides REFINE, IMPLEMENT, REVIEW, COMPLETE, and GITHUB_PR phases with gates and reflection checklists. Works with eddo-todo for task tracking.
---

# Eddo Work

Structured implementation phases for complex tasks. Uses eddo-todo for task management.

## Related Skills

- **eddo-todo**: Core task management commands (REQUIRED - load this skill first)

## Prerequisites

Load the `eddo-todo` skill first and set up variables:

```bash
# Inside Docker container:
EDDO="${PI_CODING_AGENT_DIR:-/home/agent/.pi/agent}/skills/eddo-todo/eddo-todo.js"
BRANCH=$(git branch --show-current 2>/dev/null || echo "none")
METADATA='{"agent:session":"YOUR_PI_SESSION_ID","agent:model":"YOUR_PI_MODEL","agent:cwd":"YOUR_PI_CWD","agent:branch":"'$BRANCH'"}'
```

## File Tracking

Track all files you modify during implementation in the `agent:files` metadata field (array of relative paths). This enables the Eddo UI to show which files were touched per task.

**Update metadata when you modify files:**

```bash
# After modifying files, update the parent todo's metadata
$EDDO update $PARENT_ID -M '{"agent:session":"...","agent:files":["src/Button.tsx","src/utils.ts"]}' -m "Updated file list"
```

**Get current file list from git:**

```bash
# Files changed in current branch vs main
git diff --name-only main...HEAD
```

## Trigger Pattern

```
User: "what next?"
Agent: Suggests task from `$EDDO next`
User: "let's work on this" / "start working"
Agent: Enters work mode with structured phases
```

## Critical Rules

- Test every change - never assume fixes work without verification
- Only complete subtasks when FULLY WORKING and VERIFIED
- Never git commit/push without user confirmation
- Follow all workflow phases - no shortcuts
- STOP at gates for user check-in
- **MANDATORY: Execute reflection checklist at end of EVERY phase**
- **MANDATORY: Output reflection results with ✅/❌ for each item**

---

## Phase 1: REFINE

**Start session:**

```bash
$EDDO start <id> -M "$METADATA" -m "Starting REFINE phase"
$EDDO get <id>
```

**Investigate:**

- Review todo description for context and requirements
- Read relevant codebase files
- Ask clarifying questions if needed
- Define success criteria
- Log surprising findings: `$EDDO note <id> "Discovered X depends on deprecated Y"`

**Create implementation plan as subtasks:**

```bash
PARENT_ID="<todo-id>"
CONTEXT=$(git remote get-url origin 2>/dev/null | sed 's/.*[:/]\([^/]*\/[^/]*\)\.git$/\1/' | sed 's/.*[:/]\([^/]*\/[^/]*\)$/\1/')

# Update parent with notes
$EDDO update $PARENT_ID -D "## Goal
Brief description

## Notes
Findings during investigation"

# Create subtasks (ALWAYS include -M metadata)
$EDDO create "Investigate current implementation" -c "$CONTEXT" -t gtd:next -p $PARENT_ID -M "$METADATA" -m "Subtask 1"
$EDDO create "Create new component" -c "$CONTEXT" -p $PARENT_ID -M "$METADATA" -m "Subtask 2"
$EDDO create "Update tests" -c "$CONTEXT" -p $PARENT_ID -M "$METADATA" -m "Subtask 3"
$EDDO create "User verification" -c "$CONTEXT" -p $PARENT_ID -M "$METADATA" -m "Subtask 4"
```

**Why subtasks over markdown checkboxes:**

- Each step is a first-class todo (completable, time-trackable)
- Progress visible in UI (X of Y complete)
- Steps appear in `next` command when tagged `gtd:next`

<gate>
**STOP** - Present plan (list subtasks) and ask:
- If no GitHub issue: "1. Create GitHub issue first? 2. Approve plan? (y/n)"
- If issue exists: "Approve implementation plan? (y/n)"
</gate>

**Link GitHub issue (REQUIRED if exists):**

```bash
REPO=$(git remote get-url origin 2>/dev/null | sed 's/.*[:/]\([^/]*\/[^/]*\)\.git$/\1/' | sed 's/.*[:/]\([^/]*\/[^/]*\)$/\1/')
ISSUE_NUMBER=42

$EDDO update $PARENT_ID \
  -l "https://github.com/$REPO/issues/$ISSUE_NUMBER" \
  -e "github:$REPO/issues/$ISSUE_NUMBER" \
  -m "Linked to GitHub issue"
```

<reflection>
⚠️ **MANDATORY STOP - Output this checklist:**

```
## REFINE Phase Reflection
- [ ] Time tracking started on parent todo?
- [ ] Subtasks created as todos (not markdown checkboxes)?
- [ ] Subtasks include -M metadata?
- [ ] GitHub issue linked via --link and --external-id?
- [ ] Parent description updated with Goal/Notes?

Ready to proceed to IMPLEMENT? (y/n)
```

</reflection>

---

## Phase 2: IMPLEMENT

**View progress:**

```bash
$EDDO children $PARENT_ID
```

**Execute subtasks:**

```bash
$EDDO start <subtask-id> -m "Starting subtask"
# ... do the work ...
$EDDO note $PARENT_ID "Chose X over Y because Z performs better"  # Log decisions
$EDDO complete <subtask-id> -m "Verified working"
$EDDO stop <subtask-id>
$EDDO update <next-subtask-id> -t gtd:next  # Mark next as actionable
```

**Track touched files:**
After modifying files, update the parent todo's `agent:files` metadata:

```bash
# Get list of changed files (relative paths)
FILES=$(git diff --name-only main...HEAD | jq -R . | jq -s .)

# Update metadata (preserve existing fields, add/update agent:files)
$EDDO update $PARENT_ID -M "{\"agent:session\":\"$PI_SESSION_ID\",\"agent:model\":\"$PI_MODEL\",\"agent:cwd\":\"$PI_CWD\",\"agent:branch\":\"$BRANCH\",\"agent:files\":$FILES}" -m "Updated touched files"
```

**Validate after changes:**

- Lint, format, typecheck
- Run automated tests
- Fix issues before continuing

**User testing (if applicable):**

- Present test steps
- STOP: "Please verify: [test description]. Pass? (y/n)"

**Documentation:**

- If structure/features changed, propose CLAUDE.md updates
- STOP: "Update CLAUDE.md? (y/n)"

**Changeset (if project uses them):**

```markdown
---
'package-name': patch|minor|major
---

Concise single-line description for CHANGELOG.md
```

<reflection>
⚠️ **MANDATORY STOP - Output this checklist:**

```
## IMPLEMENT Phase Reflection
- [ ] All subtasks completed and verified working?
- [ ] Lint/test/typecheck all passing?
- [ ] Changeset created (if needed)?
- [ ] CLAUDE.md updated (if architecture changed)?
- [ ] agent:files metadata updated with touched files?

💭 Notes check: Any discoveries, decisions, or gotchas worth logging?

Ready to proceed to REVIEW? (y/n)
```

</reflection>

---

## Phase 3: REVIEW

**Self-assessment:**

- Review changes for bugs, edge cases, quality issues
- Log issues found: `$EDDO note $PARENT_ID "Review caught edge case: empty array crashes map()"`
- Fix any issues found

**Visual validation (UI changes):**

```bash
screencapture -x /tmp/screenshot.png  # macOS
```

Read with `read` tool, compare Expected vs Actual.

**Final validation:**

```bash
$EDDO children $PARENT_ID  # Verify all subtasks completed
```

Run all checks/tests again.

<gate>
**STOP**: "All tests passing. Any issues to address? (describe or 'none')"
</gate>

<reflection>
⚠️ **MANDATORY STOP - Output this checklist:**

```
## REVIEW Phase Reflection
- [ ] Self-review completed (bugs, edge cases, quality)?
- [ ] Visual validation done (if UI changes)?
- [ ] All checks/tests still passing?
- [ ] `children` shows all subtasks completed?

💭 Notes check: Any edge cases or gotchas discovered during review?

Ready to proceed to COMPLETE? (y/n)
```

</reflection>

---

## Phase 4: COMPLETE

**Verify:** All subtasks must be completed.

```bash
$EDDO children $PARENT_ID  # Should show all ✓ completed
```

**Finalize file tracking:**

```bash
# Get final list of all changed files
FILES=$(git diff --name-only main...HEAD | jq -R . | jq -s .)

# Update metadata with final file list
$EDDO update $PARENT_ID -M "{\"agent:session\":\"$PI_SESSION_ID\",\"agent:model\":\"$PI_MODEL\",\"agent:cwd\":\"$PI_CWD\",\"agent:branch\":\"$BRANCH\",\"agent:files\":$FILES}" -m "Final file list"
```

**Finish session:**

```bash
$EDDO stop $PARENT_ID -m "Task complete"
```

**Completion:**

- If parent has `externalId`: Do NOT run `complete` - GitHub sync handles it
- If no `externalId`: `$EDDO complete $PARENT_ID -m "Done"`

<gate>
**STOP**: "Task complete! Options:"
1. Create PR (closes GitHub issue → auto-completes todo)
2. Continue with next todo
3. Done for now
</gate>

<reflection>
⚠️ **MANDATORY STOP - Output this checklist:**

```
## COMPLETE Phase Reflection
- [ ] Time tracking stopped on parent?
- [ ] Parent todo completed (if no externalId)?
- [ ] All commits have descriptive messages?
- [ ] Changeset file committed?
- [ ] agent:files metadata finalized?

Ready to proceed to GITHUB_PR (or end)? (y/n)
```

</reflection>

---

## Phase 5: GITHUB_PR

**Preflight:**

```bash
git branch --show-current  # Verify NOT on main
git status                 # Check for unstaged changes
```

- On `main`: STOP, ask to create feature branch
- Unstaged changes: STOP, ask what to do

**Create PR:**

- Title: Follow project's commit conventions
- Description: Concise, reference GitHub issue (e.g., "Closes #123")
- No "generated by" or "co-authored" text

<reflection>
⚠️ **MANDATORY STOP - Output this checklist:**

```
## GITHUB_PR Phase Reflection
- [ ] PR references GitHub issue?
- [ ] PR description is concise and clear?
- [ ] Branch is correct (not main)?
- [ ] All CI checks expected to pass?

Work mode complete. Confirm all items are ✅.
```

</reflection>

---

## Example Flow

```
User: what next?
Agent: 🚀 "Add dark mode toggle" @eddoapp [gtd:next] - Want to work on this?

User: yes
Agent: [enters work mode]
       - Starts time tracking
       - Investigates codebase
       - Adds note: "ThemeProvider uses CSS vars - can extend"
       - Creates 4 subtasks
       STOP: "Here's my plan. Approve? (y/n)"

User: go ahead
Agent: [implements step by step]
       - Works on subtasks, completes when verified
       - Adds notes for decisions
       - STOP at milestones

       [all subtasks completed]
       All tests passing. Task complete!
       1. Create PR? 2. Next todo? 3. Done?

User: create PR
Agent: [creates PR]
```
