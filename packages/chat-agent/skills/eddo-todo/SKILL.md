---
name: eddo-todo
description: Todo and task management via Eddo MCP server. Use for tracking work items, remembering tasks, managing project todos and time tracking. Supports GTD workflow with contexts and actionability tags (next actions, projects, waiting, someday). Use this skill whenever you need to remember something, track progress, or manage your own task list.
---

# Eddo Todo

Task management for the coding agent. Track todos, manage projects, log time.

<critical>
⚠️ **REQUIRED: Set these shell variables before running ANY command!**

**Step 1: Set EDDO path** (the CLI lives in this skill's directory):

```bash
# Inside Docker container:
EDDO="/home/agent/.pi/agent/skills/eddo-todo/eddo-todo.js"

# Or use environment variable if set:
EDDO="${PI_CODING_AGENT_DIR:-/home/agent/.pi/agent}/skills/eddo-todo/eddo-todo.js"
```

**Step 2: Build METADATA** (extract values from `<pi_session_metadata>` in your context):

```bash
BRANCH=$(git branch --show-current 2>/dev/null || echo "none")
METADATA='{"agent:session":"YOUR_PI_SESSION_ID","agent:model":"YOUR_PI_MODEL","agent:cwd":"YOUR_PI_CWD","agent:branch":"'$BRANCH'"}'
```

Replace `YOUR_PI_SESSION_ID`, `YOUR_PI_MODEL`, `YOUR_PI_CWD` with actual values from `<pi_session_metadata>`.

**Step 3: Use the variables:**

```bash
$EDDO next
$EDDO get <id>
$EDDO create "Task" -c context -t gtd:next -M "$METADATA" -D "task description" -m "why creating this"
```

⚠️ **DO NOT** look for eddo.js in the current working directory - it's in the skill directory.
⚠️ **DO NOT** use placeholder text like `<PI_SESSION_ID>` literally - substitute actual values.
</critical>

## Related Skills

- **eddo-work**: Structured phases for implementing complex tasks (REFINE → IMPLEMENT → REVIEW → COMPLETE → GITHUB_PR)

## Setup

**Prerequisite**: Eddo MCP server accessible from container (via Docker network)

```bash
# Inside Docker container:
EDDO="/home/agent/.pi/agent/skills/eddo-todo/eddo-todo.js"

# The MCP URL should be set via environment variable by the container orchestrator
# Default: http://host.docker.internal:3001/mcp (to reach host's MCP server)
export EDDO_MCP_URL=${EDDO_MCP_URL:-http://host.docker.internal:3001/mcp}

# MCP API key (stored in user preferences)
export EDDO_MCP_API_KEY=${EDDO_MCP_API_KEY:-""}
```

## Short Flags

**ALWAYS use short flags** - saves tokens:

| Short | Long            | Short | Long                  |
| ----- | --------------- | ----- | --------------------- |
| `-c`  | `--context`     | `-t`  | `--tag`               |
| `-d`  | `--due`         | `-m`  | `--message`           |
| `-D`  | `--description` | `-l`  | `--link`              |
| `-e`  | `--external-id` | `-E`  | `--clear-external-id` |
| `-p`  | `--parent-id`   | `-P`  | `--clear-parent`      |
| `-b`  | `--blocked-by`  | `-B`  | `--clear-blockers`    |
| `-M`  | `--metadata`    | `-u`  | `--undo`              |

**ALWAYS use `-D` for task description** (what), **`-m` for audit message** (why), and **`-M` for metadata on create**.

## Commands

### next - GTD Candidates

```bash
$EDDO next                           # Show actionable candidates
$EDDO next --context eddoapp         # Candidates for specific project
```

**Priority groups**: ⚠️ OVERDUE → 🚀 NEXT ACTIONS → 📅 DUE SOON → 📋 PROJECTS → 📝 OTHER

### list - Filter todos

```bash
$EDDO list                           # All todos
$EDDO list --context eddoapp         # Filter by project
$EDDO list --completed               # Show completed
$EDDO list --tag gtd:next            # Next actions only
```

### get - Full details

```bash
$EDDO get <id>
```

### create - New todo

```bash
$EDDO create "Fix bug" -c work -t gtd:next -M "$METADATA" -D "Login fails on Safari when cookies disabled" -m "Found during QA testing"
$EDDO create "Subtask" -c work -t gtd:next -p "parent-id" -M "$METADATA" -D "Implement JWT refresh logic" -m "Breaking down auth project"
$EDDO create "Issue #42" -c work -t gtd:next \
  -l "https://github.com/owner/repo/issues/42" \
  -e "github:owner/repo/issues/42" -M "$METADATA" -D "User reports crash on startup" -m "Imported from GitHub"
```

### update - Modify todo

```bash
$EDDO update <id> --title "New title"
$EDDO update <id> --due 2025-01-15 -m "Pushed to next week"
$EDDO update <id> -p "new-parent"    # Set parent
$EDDO update <id> -P                 # Clear parent (make root-level)
$EDDO update <id> -B                 # Clear blockers
$EDDO update <id> -E                 # Clear external ID
$EDDO update <id> --clear-metadata   # Clear metadata
```

### children - List subtasks

```bash
$EDDO children <parent-id>
```

### complete - Mark done

```bash
$EDDO complete <id> -m "Fixed the bug"
$EDDO complete <id> --undo           # Uncomplete
```

### delete - Remove todo

```bash
$EDDO delete <id>
```

### notes - Work diary

```bash
$EDDO note <id> "Note content"       # Add note
$EDDO notes <id>                     # List notes
$EDDO note-delete <id> <note-id>     # Delete note
```

**Worth noting**: Discoveries, decisions + reasoning, surprises, blockers, gotchas, insights.
**NOT worth noting**: "Started X", "Completed Y" (tracked elsewhere).

### attachments - File attachments

```bash
$EDDO attach <id> /path/to/file.png              # Attach file to todo
$EDDO attach <id> /path/to/file.png --name chart.png  # Override filename
$EDDO attachments <id>                           # List attachments
$EDDO get-attachment <docId> --output /tmp/img.png  # Download attachment
$EDDO get-attachment <docId> --base64            # Output base64 to stdout
```

Uploads file to attachments database and appends markdown reference to todo description.
**Supported types**: PNG, JPEG, GIF, WebP, PDF (max 5MB).

To read an image from a todo, first list attachments to get the docId, then download it.

### Time tracking

```bash
$EDDO start <id> -M "$METADATA" -m "Beginning work"  # Start with metadata
$EDDO stop <id> -m "Pausing"
$EDDO active                         # Show active tracking
```

### info - Server status

```bash
$EDDO info
```

## GTD System

**Tags** (actionability):

| Tag            | When to Use                                        |
| -------------- | -------------------------------------------------- |
| `gtd:next`     | Ready to execute, no blockers                      |
| `gtd:project`  | Multi-step outcome                                 |
| `gtd:waiting`  | Blocked on external input (person, event)          |
| `gtd:blocked`  | Blocked on internal task (use with `--blocked-by`) |
| `gtd:someday`  | Not committed, future possibility                  |
| `gtd:calendar` | Time-specific (prefix title with HH:MM)            |

**Contexts** (where/when):

| Context      | When to Use                                 |
| ------------ | ------------------------------------------- |
| `owner/repo` | GitHub repo slug (e.g., `walterra/eddoapp`) |
| `inbox`      | Uncategorized (default)                     |
| `private`    | Personal non-work                           |
| `errands`    | Physical location tasks                     |

**Derive context from git:**

```bash
git remote get-url origin 2>/dev/null | sed 's/.*[:/]\([^/]*\/[^/]*\)\.git$/\1/' | sed 's/.*[:/]\([^/]*\/[^/]*\)$/\1/'
```

## GitHub Integration

Link todos to GitHub issues for auto-completion when issue closes.

**External ID format**: `github:owner/repo/issues/NUMBER`

```bash
REPO=$(git remote get-url origin 2>/dev/null | sed 's/.*[:/]\([^/]*\/[^/]*\)\.git$/\1/' | sed 's/.*[:/]\([^/]*\/[^/]*\)$/\1/')
ISSUE_NUMBER=42

$EDDO update <id> \
  --link "https://github.com/$REPO/issues/$ISSUE_NUMBER" \
  --external-id "github:$REPO/issues/$ISSUE_NUMBER"
```

⚠️ **NEVER manually complete todos with externalId** - let GitHub sync handle it!

## Parent-Child Relationships

```bash
# Create parent
$EDDO create "Build auth system" -c eddoapp -t gtd:project -M "$METADATA" -D "OAuth2 + JWT authentication" -m "New feature request"

# Create subtasks (use parent's ID)
$EDDO create "Design login" -c eddoapp -t gtd:next -p "parent-id" -M "$METADATA" -D "Figma mockups for login flow" -m "Breaking down project"
$EDDO create "Implement JWT" -c eddoapp -p "parent-id" -M "$METADATA" -D "Backend token generation and validation" -m "Breaking down project"

# View subtasks
$EDDO children <parent-id>
```

## Task Dependencies (blockedBy)

Use `gtd:blocked` tag with `-b` to track internal task dependencies.

```bash
# Mark task B as blocked by task A
$EDDO update <B> -t gtd:blocked -b <A> -m "Blocked by task A"

# Multiple blockers (repeatable flag)
$EDDO update <B> -t gtd:blocked -b <A1> -b <A2> -m "Blocked by A1 and A2"

# Clear all blockers
$EDDO update <B> -B -t gtd:next -m "Unblocked"
```

**Behavior:**

- Tasks with `gtd:blocked` tag or incomplete `blockedBy` references are excluded from `next`
- Distinct from `gtd:waiting` which is for external blocks (people, events)
- Supports cross-project dependencies (not just parent-child)

## Metadata

⚠️ **MANDATORY: ALWAYS include `-M` metadata on EVERY `create` command.**

**Required fields** (from `<pi_session_metadata>`):

| Field           | Source                      |
| --------------- | --------------------------- |
| `agent:session` | `PI_SESSION_ID`             |
| `agent:model`   | `PI_MODEL`                  |
| `agent:cwd`     | `PI_CWD`                    |
| `agent:branch`  | `git branch --show-current` |

```bash
$EDDO create "Task" -c ctx -t gtd:next -M "$METADATA" -D "What the task is about" -m "Why creating it"
```

## Examples

```bash
# Quick task management
$EDDO create "Fix login bug" -c work -t gtd:next -M "$METADATA" -D "Login fails on Safari when cookies disabled" -m "User reported in support ticket #123"
$EDDO create "Learn Rust" -c private -t gtd:someday -M "$METADATA" -D "Work through the Rust book, build a CLI tool" -m "Adding to someday list"

# Simple time tracking
$EDDO next                    # Get next action
$EDDO start <id> -M "$METADATA" -m "Starting work on this"
# ... work ...
$EDDO stop <id> -m "Pausing for lunch"
$EDDO complete <id> -m "Fixed by clearing stale cookies"
```
