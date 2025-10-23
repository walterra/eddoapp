- proper timezone support
- the gtd tags like `gtd:next` should be a `gtd` attribute on todos just like context and be stored just `next`, will trigger creating TodoAlpha5
- peristent chat history for telegram-bot
- chat interface in the web-ui
- eddo*user_registry is the couchdb user registry. eddo_user*\* are the todos for each user. looks like a prefix naming clash. what if someone registered with a username "registry"?
- **ADD ERROR HANDLING**: Implement Stoker middleware for consistent error responses https://github.com/w3cj/stoker
- **OPTIMIZE PERFORMANCE**: Add proper caching headers and asset optimization
- alternative layout option instead of the kanban board: condensed table, sections intead of boards

## Follow-up Items from /briefing recap Implementation

### High Priority

- Fix timezone handling in recap date calculations (briefing.ts:25-33) - Currently uses local time, should use UTC or user timezone
- Add empty results handling to recap prompt - Provide guidance when no todos completed today
- Verify index selection logic for completion date ranges (mcp-server.ts:398-409) - May need optimization

### Code Quality & Testing

- Update help text to explain automatic recap scheduling (briefing.ts:87)
- Add validation that completedFrom < completedTo in MCP tool
- Fix or remove two-message pattern instruction (doesn't work with current agent implementation)
- Add Zod datetime validation for date parameters in MCP tool
- Add test for `completed: true` + date range combination
- Update test fixtures to include `printBriefing`/`printRecap` fields
