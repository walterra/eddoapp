# in spec/stevens-demo-comparison.md we defined a way to store memories. let's implement it. we need to update system prompts in two ways: the system prompt needs to know that when a user asks to remember something that the todo should be the MemoryTodo (e.g. tagged with `user:memory`). The other way around we need to query CouchDB for all tasks tagged `user:memory` and add that to the system prompt.

**Status:** In Progress
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
- [ ] User test: Ask bot to "remember my favorite coffee is espresso" and verify todo is created with correct tag
- [ ] User test: In new conversation, reference the remembered information and verify bot has access to it