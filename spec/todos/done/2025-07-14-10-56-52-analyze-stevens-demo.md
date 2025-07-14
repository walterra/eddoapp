# have a look at /Users/walterra/dev/stevensDemo and analyse its features. compare them to this eddo repo. document the differences in spec/stevens-demo-comparision.md

**Status:** Done
**Created:** 2025-07-14T10:56:52
**Started:** 2025-07-14T10:58:00
**Completed:** 2025-07-14T11:15:00
**Agent PID:** 1664

## Original Todo

have a look at /Users/walterra/dev/stevensDemo and analyse its features. compare them to this eddo repo. document the differences in spec/stevens-demo-comparision.md

## Description

I will document the features present in stevensDemo that are missing from eddo app, focusing on capabilities that could enhance eddo's functionality:

1. **Chat History Persistence**:
   - Dedicated telegram_chats table storing full conversation history
   - Enables contextual responses across multiple sessions
   - Chat history retrieval for AI context

2. **Memory System**:
   - Flexible "memories" table for storing contextual information
   - Ability to pre-populate onboarding memories
   - Tagged memory organization with date associations
   - Memory retrieval functions for AI context

3. **Automated Data Import**:
   - Weather forecast integration
   - USPS mail tracking
   - Calendar event synchronization
   - Automatic capture of Telegram messages as memories

4. **Daily Briefings**:
   - Scheduled morning summaries via Telegram
   - AI-generated contextual briefings
   - Weather summaries with clothing recommendations
   - Integration of multiple data sources

5. **Admin Dashboard**:
   - Web interface for viewing and managing memories
   - Memory search and filtering capabilities
   - Direct database visibility

6. **AI Persona System**:
   - Structured backstory and personality definition
   - Consistent butler persona across interactions
   - Context-aware responses based on stored memories

The document will provide actionable insights on which features could be adapted to enhance eddo's capabilities, particularly around chat persistence and memory management.

## Implementation Plan

- [x] Analyze stevensDemo's chat persistence implementation (packages/telegram-bot/src/bot/chats.ts, database schema)
- [x] Examine stevensDemo's memory system structure (dbUtils/, memoryUtils.ts, database tables)
- [x] Review stevensDemo's data importers (importers/ directory - weather, mail, calendar)
- [x] Study daily briefing implementation (dailyBriefing/ directory)
- [x] Investigate admin dashboard features (dashboard/ directory)
- [x] Analyze AI persona implementation (backstory.ts, prompt construction)
- [x] Create spec/stevens-demo-comparison.md with structured feature comparison
- [x] Automated test: Verify markdown file is created and properly formatted
- [x] User test: Review the comparison document for completeness and accuracy

## Notes

**Context Window Management Discovery:**
- stevensDemo uses simple hard limits (50 messages) for chat history
- No sophisticated truncation - just "last N messages" approach
- Relies on separate memory system for long-term context preservation
- No token counting or intelligent context management
- Potential issue: growing context could still exceed model limits with long conversations

**Database Architecture Analysis:**
- stevensDemo uses shared database with chat_id isolation
- Security limitation: shared memories table with no user isolation
- Single-user focus: designed for personal/household use only
- Recommendation: eddo should use per-user database architecture (consistent with MCP server pattern)
- Implementation: CouchDB/PouchDB JSON documents instead of SQL tables