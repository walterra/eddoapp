# Issue #55: Make Personas MCP-Agnostic

## Problem Statement

Currently, personas contain hard-coded MCP action definitions in their `systemPrompt` property, creating tight coupling between persona personality and MCP capabilities. This leads to:

- **Code duplication**: Identical MCP action descriptions across all persona files
- **Maintenance overhead**: Changes to MCP capabilities require updates in multiple files
- **Inflexibility**: Personas can't adapt to dynamic MCP tool discovery
- **Poor separation of concerns**: Personality mixed with technical capabilities

## Current Implementation Issues

### Hard-coded MCP Actions in Personas

All persona files (`butler.ts`, `gtd-coach.ts`, `zen-master.ts`) contain identical MCP capability descriptions:

```typescript
systemPrompt: `...
Your capabilities through the MCP server:
- **createTodo**: Create new todos with title, description, context, due date, tags, repeat interval, and links
- **listTodos**: Query todos with filters (context, completion status, date range)
- **updateTodo**: Modify existing todos (requires finding the ID first)
// ... etc (lines 8-47 in butler.ts)
```

### Multiple Sources of Truth

MCP capabilities are defined in multiple locations:
- Individual persona files (hard-coded)
- `mcp/info-service.ts` (fallback definitions, lines 182-285)
- `services/action-registry.ts` (action mappings, lines 184-220)

## Proposed Solution

### 1. Refactor Persona Interface

Remove MCP-specific fields and focus on personality:

```typescript
export interface Persona {
  id: string;
  name: string;
  personalityPrompt: string; // Renamed from systemPrompt
  acknowledgmentEmoji: string;
  acknowledgmentTemplates: {
    action: string; // Generic template: "{emoji} {action_phrase}! Let me {action_description}..."
    fallback: string;
  };
  messages: {
    roleDescription: string;
    welcomeContent: string;
    closingMessage: string;
  };
}
```

### 2. Dynamic System Prompt Generation

Create a service that combines persona personality with dynamic MCP capabilities:

```typescript
// New service: PersonaPromptBuilder
export class PersonaPromptBuilder {
  static async buildSystemPrompt(
    persona: Persona,
    mcpTools: McpToolInfo[]
  ): Promise<string> {
    const toolDescriptions = this.formatToolsForPrompt(mcpTools);
    
    return `${persona.personalityPrompt}

Your capabilities through the MCP server:
${toolDescriptions}

${this.getCommonInstructions()}`;
  }
  
  private static formatToolsForPrompt(tools: McpToolInfo[]): string {
    return tools.map(tool => 
      `- **${tool.name}**: ${tool.description}`
    ).join('\n');
  }
  
  private static getCommonInstructions(): string {
    return `Date Handling:
- Always convert natural language dates to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
- Default time is 23:59:59.999Z if not specified
- Understand "tomorrow", "next Friday", "June 25th", "in 3 days", etc.
- Use current date as reference for relative dates

When users make requests:
1. Parse their intent carefully, understanding both explicit requests and implied needs
2. Extract all relevant information (title, context, dates, etc.)
3. Use appropriate MCP tools to fulfill their request
4. When updating/completing/deleting, first list to find the correct todo ID
5. Provide helpful responses confirming actions taken`;
  }
}
```

### 3. Simplified Persona Definitions

Remove hard-coded MCP content from persona files:

```typescript
// In butler.ts - MCP-agnostic persona definition
export const butler: Persona = {
  id: 'butler',
  name: 'Mr. Stevens',
  personalityPrompt: `You are Mr. Stevens, a sophisticated digital butler working for the Eddo todo management system. You help users manage their tasks with elegance, efficiency, and a professional demeanor.

Always be:
- Professional and courteous
- Proactive in offering assistance  
- Clear about what actions you're taking
- Efficient in helping users achieve their goals

Remember: You're not just a task manager, you're a digital butler committed to making your user's life more organized and productive.`,
  acknowledgmentEmoji: '🎩',
  acknowledgmentTemplates: {
    action: '🎩 Certainly! Let me {action_description}...',
    fallback: '🎩 My apologies, I encountered a momentary difficulty processing your request. Please try again, and I shall be delighted to assist you.',
  },
  messages: {
    roleDescription: 'personal digital butler',
    welcomeContent: 'manage your todos and tasks with elegance and efficiency', 
    closingMessage: 'At your service',
  },
};
```

## Implementation Plan

### Phase 1: Create Infrastructure
1. **Create PersonaPromptBuilder service** (`src/ai/persona-prompt-builder.ts`)
2. **Update persona-types.ts** with new interface
3. **Create migration utility** to convert existing personas

### Phase 2: Refactor Personas
1. **Update butler.ts** to use new MCP-agnostic format
2. **Update gtd-coach.ts** to focus on coaching personality
3. **Update zen-master.ts** to focus on mindful guidance
4. **Remove hard-coded MCP content** from all persona files

### Phase 3: Update Usage Points
1. **Modify enhanced-langgraph-workflow.ts** to use dynamic prompt generation
2. **Update any other files** that consume persona systemPrompt
3. **Integrate with existing MCP discovery services**

### Phase 4: Cleanup
1. **Remove old acknowledgment mappings** that are MCP-specific
2. **Update tests** to reflect new persona structure
3. **Verify dynamic tool discovery** works with all personas

## Integration with Existing Services

This refactoring leverages existing MCP infrastructure:

- **McpToolDiscoveryService** (`services/mcp-tool-discovery.ts`): For dynamic tool discovery
- **McpInfoService** (`mcp/info-service.ts`): For tool formatting and caching
- **ActionRegistry** (`services/action-registry.ts`): For action mapping (unchanged)

## Benefits

- **Dynamic tool discovery**: Personas automatically adapt to available MCP tools
- **Reduced code duplication**: MCP capabilities defined once in discovery services
- **Easier maintenance**: Persona changes don't require MCP updates
- **Better separation of concerns**: Personality vs. capability information separated
- **Future-proof**: Works with any MCP server configuration
- **Consistent behavior**: All personas use same up-to-date MCP tool information

## Files to Modify

### Core Changes
- `src/ai/persona-types.ts` - Update interface
- `src/ai/personas/butler.ts` - Remove MCP content
- `src/ai/personas/gtd-coach.ts` - Remove MCP content  
- `src/ai/personas/zen-master.ts` - Remove MCP content

### New Files
- `src/ai/persona-prompt-builder.ts` - Dynamic prompt generation service

### Integration Points
- `src/agent/enhanced-langgraph-workflow.ts` - Use dynamic prompts
- Any other files consuming `persona.systemPrompt`

## Testing Strategy

1. **Unit tests** for PersonaPromptBuilder service
2. **Integration tests** ensuring personas work with dynamic MCP tools
3. **Regression tests** to verify existing functionality is preserved
4. **Manual testing** of each persona with different MCP configurations

## Related Issues

- Issue #54: Remove hard-coded MCP actions (broader scope)
- Issue #53: Dynamic MCP information handling
- Issue #51: MCP integration planning

This refactoring is a focused subset of Issue #54, specifically addressing persona MCP coupling while leveraging the existing dynamic tool discovery infrastructure.