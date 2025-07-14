# in spec/stevens-demo-comparison.md we defined a way to store memories. let's implement it. we need to update system prompts in two ways: the system prompt needs to know that when a user asks to remember something that the todo should be the MemoryTodo (e.g. tagged with `user:memory`). The other way around we need to query CouchDB for all tasks tagged `user:memory` and add that to the system prompt.

**Status:** Done
**Started:** 2025-07-14T21:44:45
**Created:** 2025-07-14T21:44:12
**Agent PID:** 1664

## Original Todo

in spec/stevens-demo-comparison.md we defined a way to store memories. let's implement it. we need to update system prompts in two ways: the system prompt needs to know that when a user asks to remember something that the todo should be the MemoryTodo (e.g. tagged with `user:memory`). The other way around we need to query CouchDB for all tasks tagged `user:memory` and add that to the system prompt.

## Description

Implement a memory system for the Telegram bot using the existing todo infrastructure. The system will enable the bot to remember user interactions and preferences by storing them as todos tagged with `user:memory`. This involves two key integrations:

1. **Memory Creation**: When users ask the bot to remember something, use existing `createTodo` tool with `user:memory` tag
2. **Memory Retrieval**: Query existing todos with `user:memory` tag using `listTodos` and include them in the AI system prompt for context-aware responses

The system leverages the existing todo infrastructure and MCP server architecture while maintaining service isolation.

## Implementation Plan

- [x] Update system prompt instructions to tell AI to use `createTodo` with `user:memory` tag when users ask to remember something (packages/telegram_bot/src/agent/system-prompt.ts)
- [x] Add memory retrieval in agent loop - call `listTodos` with `user:memory` tag filter before building system prompt (packages/telegram_bot/src/agent/simple-agent.ts)
- [x] Update `buildSystemPrompt()` to accept and display retrieved memory todos in the prompt context (packages/telegram_bot/src/agent/system-prompt.ts)
- [x] Automated test: Test memory creation via existing `createTodo` tool with `user:memory` tag
- [x] Automated test: Test memory retrieval via `listTodos` filter for `user:memory` tag
- [x] User test: Ask bot to "remember my favorite coffee is espresso" and verify todo is created with correct tag
- [x] User test: In new conversation, reference the remembered information and verify bot has access to it

## Notes

**Architecture Improvements**: 
1. **Memory Creation**: Moved memory creation instructions from Telegram bot system prompt to MCP server `createTodo` tool description 
2. **Memory Retrieval**: Moved memory retrieval from Telegram bot direct database access to MCP server `getServerInfo` tool with new 'memories' section

This keeps the Telegram bot completely agnostic - it no longer contains any memory-specific logic. The MCP server now handles all memory operations through its tools, maintaining proper separation of concerns.

**Logging Enhancement**: Added system prompt to agent state logging. The system prompt (including retrieved memories) is now captured in the agent state logs at `packages/telegram_bot/logs/agent-states/` for debugging and analysis. This will help track how memories are being included in the AI context.

**Major System Prompt Refactor**: Replaced separate tool descriptions with comprehensive `getServerInfo(section: 'all')` call. The system prompt now includes:
- **Complete tool documentation** from MCP server 
- **Tag statistics** showing most used tags
- **User memories** for context-aware responses
- **Data model info** and **usage examples**

This provides much richer context to the AI while maintaining clean architecture - the Telegram bot gets all necessary information from a single MCP server call.