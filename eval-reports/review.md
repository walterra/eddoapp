# Recording review

Recorded behavior only. Full findings and evidence: [review.json](review.json).

| Scenario | anthropic/claude-sonnet-4-5-20250929 | openai/gpt-5.2 | qwen38/qwen3.8-27b |
| --- | --- | --- | --- |
| ambiguous-input | Pass | Concern | Concern |
| complete-todo-workflow | Pass | Pass | Pass |
| create-todo-context-tags | Concern | Concern | Concern |
| create-todo-natural-language | Pass | Pass | Pass |
| multi-step-create-list | Pass | Pass | Pass |
| persistent-chat-history | Pass | Pass | Pass |
| status-message-pattern | Pass | Pass | Pass |

## Concerns

- **anthropic/claude-sonnet-4-5-20250929 / create-todo-context-tags · task_fulfillment:** It created a work todo with an urgent tag, but set the due date to end of December rather than a clear date “next month” (December) such as early/mid-month. (partial; event-2, event-3, event-1)
- **anthropic/claude-sonnet-4-5-20250929 / create-todo-context-tags · instruction_compliance:** It added an extra “gtd:next” tag not requested by the user, though other requested fields (work context, urgent tag) were followed. (partial; event-2, event-1)
- **anthropic/claude-sonnet-4-5-20250929 / create-todo-context-tags · communication_quality:** The response is clear but asserts “end of December” and “urgent priority” without mentioning the exact due date returned by the tool (2026-12-31). (partial; event-4, event-3)
- **openai/gpt-5.2 / ambiguous-input · task_fulfillment:** It did not add a todo but appropriately asked for the missing title and due date needed to proceed from the vague request. (partial; event-1, event-2)
- **openai/gpt-5.2 / create-todo-context-tags · task_fulfillment:** It created a work todo with an urgent tag, but set the due date to 2026-12-31 rather than an unspecified date within “next month” (December 2026). (partial; event-1, event-2, event-3, event-4)
- **openai/gpt-5.2 / create-todo-context-tags · instruction_compliance:** It followed the request for a work todo and urgent tag, but chose an arguably too-specific end-of-month due date instead of asking or selecting a clearer “next month” date. (partial; event-1, event-2, event-4)
- **qwen38/qwen3.8-27b / ambiguous-input · task_fulfillment:** It did not add a todo, but it appropriately asked for the missing task details needed to proceed. (partial; event-1, event-2)
- **qwen38/qwen3.8-27b / create-todo-context-tags · claims_grounded_in_results:** It claimed tags urgent and gtd:next were applied, but the tool result data shows only id/title/context/due and not tags. (partial; event-3, event-4)
