# Recording review

Recorded behavior only. Full findings and evidence: [review.json](review.json).

| Scenario | anthropic/claude-sonnet-4-5-20250929 | openai/gpt-5.2 |
| --- | --- | --- |
| ambiguous-input | Pass | Pass |
| complete-todo-workflow | Pass | Pass |
| create-todo-context-tags | Pass | Pass |
| create-todo-natural-language | Pass | Pass |
| multi-step-create-list | Pass | Pass |
| persistent-chat-history | Pass | Pass |
| status-message-pattern | Concern | Pass |

## Concerns

- **anthropic/claude-sonnet-4-5-20250929 / status-message-pattern · instruction_compliance:** It complied with both user requests but added an unrequested due date and tag when creating the todo. (partial; event-1, event-2)
