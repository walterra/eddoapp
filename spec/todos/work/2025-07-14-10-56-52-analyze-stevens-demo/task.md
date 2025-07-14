# have a look at /Users/walterra/dev/stevensDemo and analyse its features. compare them to this eddo repo. document the differences in spec/stevens-demo-comparision.md

**Status:** Refining
**Created:** 2025-07-14T10:56:52
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

- [ ] Analyze stevensDemo's chat persistence implementation (packages/telegram-bot/src/bot/chats.ts, database schema)
- [ ] Examine stevensDemo's memory system structure (dbUtils/, memoryUtils.ts, database tables)
- [ ] Review stevensDemo's data importers (importers/ directory - weather, mail, calendar)
- [ ] Study daily briefing implementation (dailyBriefing/ directory)
- [ ] Investigate admin dashboard features (dashboard/ directory)
- [ ] Analyze AI persona implementation (backstory.ts, prompt construction)
- [ ] Create spec/stevens-demo-comparison.md with structured feature comparison
- [ ] Automated test: Verify markdown file is created and properly formatted
- [ ] User test: Review the comparison document for completeness and accuracy