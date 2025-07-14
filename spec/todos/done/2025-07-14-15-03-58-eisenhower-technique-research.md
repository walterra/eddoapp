# research the eisenhower technique. can it be used for tagging todos?

**Status:** Done
**Created:** 2025-07-14T15:03:58Z
**Started:** 2025-07-14T15:45:00Z
**Completed:** 2025-07-14T16:15:00Z
**Agent PID:** 1664

## Original Todo

- research the eisenhower technique. can it be used for tagging todos?

## Description

After researching the Eisenhower Matrix and evaluating integration options, decided to implement a pure GTD approach instead of mixing GTD with Eisenhower. The Eisenhower Matrix (urgent/important quadrants) creates unnecessary complexity and significant overlap with GTD's "next actions" concept. A focused GTD tag system with prefixed tags provides better clarity and workflow efficiency.

## Implementation Plan

- [x] Update MCP server system prompt with GTD tag definitions and usage rules
- [x] Provide GTD tag guidelines for LLM to intelligently select appropriate tags
- [x] Add GTD-aware query processing for natural language requests
- [x] Test with Telegram bot to ensure proper GTD behavior
- [x] Update project documentation with GTD tag usage guidelines

## Notes

**GTD Tag System Implemented:**
- `gtd:next` = Next Actions (ready to do, clear actionable steps)
- `gtd:someday` = Someday/Maybe (not ready to act, review later)  
- `gtd:waiting` = Waiting For (blocked by others)
- `gtd:project` = Projects (multi-step outcomes)

**LLM-Guided GTD Tag Selection:**
- MCP server provides clear guidelines for LLM to select appropriate GTD tags
- No brittle inference logic - relies on LLM intelligence for contextual tagging
- Integrates seamlessly with existing tag system
- Telegram bot system prompt instructs LLM to add GTD tags when creating todos

**Key Benefits Over Eisenhower:**
- Eliminates overlap between urgent/important and GTD "next" 
- Maintains focus on actionability rather than artificial prioritization
- Leverages existing robust tag infrastructure
- Provides clear workflow for GTD practitioners

**Implementation Approach:**
- Instructions provided to LLM via MCP server tool descriptions
- GTD-specific guidance moved to GTD coach persona (tool-agnostic system prompt)
- Query processing enhanced to handle GTD-specific requests like "what's next?"
- Flexible system that relies on LLM intelligence rather than rigid code logic
- Clear distinction between tags (gtd:next, gtd:project, etc.) and context (work, private, etc.)
- Examples corrected to show proper usage of tags vs context attributes
- Clean separation: generic system prompt, GTD-specific persona, MCP tool descriptions
- Eliminated overlap between MCP server and GTD coach - MCP server takes precedence for technical details
- Removed confusing next_actions from MCP server responses - agent loop drives workflow planning
- Fixed tool execution flow to prevent hallucinations - LLM must call tools FIRST, then respond with actual data