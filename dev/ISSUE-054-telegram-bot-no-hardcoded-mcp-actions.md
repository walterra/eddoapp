# Refactoring Plan: Remove Hard-Coded MCP Actions from Telegram Bot

## Problem Statement

The telegram-bot package currently has MCP (Model Context Protocol) action definitions hard-coded in multiple locations, preventing dynamic discovery of available tools from MCP servers. This creates maintenance overhead and limits extensibility.

## Current State Analysis

### Files with Hard-Coded MCP Actions

1. **packages/telegram-bot/src/agent/enhanced-plan-generator.ts:99-116**
   - Hard-coded list of available actions in prompt template
   - Uses camelCase naming convention

2. **packages/telegram-bot/src/agent/enhanced-step-executor.ts:199-225**
   - `actionMapping` object mapping action names to tool names
   - Includes legacy snake_case mappings for backward compatibility
   - Maps artificial actions to real actions

3. **packages/telegram-bot/src/agent/enhanced-langgraph-workflow.ts:362-392**
   - Duplicate `actionMapping` object (same as enhanced-step-executor.ts)
   - Additional mappings for `daily_summary` and `analysis`

4. **packages/telegram-bot/src/agent/adapter.ts:71-158**
   - Hard-coded method implementations for each MCP action
   - Uses `findTool` with arrays of possible tool name variations
   - Each method has 3-4 hard-coded name variants

5. **packages/telegram-bot/src/agent/complex-planner.ts:124-133**
   - Hard-coded action list in planning prompt
   - Uses legacy snake_case naming convention

### Key Issues

- **Duplication**: Action mappings duplicated across 3 files
- **Inconsistent Naming**: Mix of camelCase and snake_case
- **Static Nature**: Cannot discover new tools without code changes
- **Maintenance Burden**: Adding/modifying tools requires updating multiple files

## Proposed Solution

### Phase 1: Create Dynamic Tool Discovery Service

1. **Create Tool Discovery Service** (`packages/telegram-bot/src/services/mcp-tool-discovery.ts`)
   ```typescript
   interface McpTool {
     name: string;
     description: string;
     inputSchema?: any;
   }

   class McpToolDiscoveryService {
     private cachedTools: Map<string, McpTool> = new Map();
     
     async discoverTools(mcp: MCP): Promise<McpTool[]> {
       // Query MCP server for available tools
       const tools = await mcp.listTools();
       
       // Cache tools for performance
       tools.forEach(tool => this.cachedTools.set(tool.name, tool));
       
       return tools;
     }
     
     async getToolByName(name: string): Promise<McpTool | undefined> {
       return this.cachedTools.get(name);
     }
     
     async findToolByVariants(variants: string[]): Promise<McpTool | undefined> {
       for (const variant of variants) {
         const tool = this.cachedTools.get(variant);
         if (tool) return tool;
       }
       return undefined;
     }
   }
   ```

### Phase 2: Create Action Registry

2. **Create Action Registry** (`packages/telegram-bot/src/services/action-registry.ts`)
   ```typescript
   interface ActionMetadata {
     aliases: string[];  // Legacy names, variations
     category: 'crud' | 'time-tracking' | 'utility';
     description: string;
   }

   class ActionRegistry {
     private registry: Map<string, ActionMetadata> = new Map();
     
     async initialize(discoveryService: McpToolDiscoveryService): Promise<void> {
       const tools = await discoveryService.discoverTools();
       
       // Register discovered tools with metadata
       tools.forEach(tool => {
         this.registry.set(tool.name, {
           aliases: this.generateAliases(tool.name),
           category: this.categorizeAction(tool.name),
           description: tool.description
         });
       });
     }
     
     getAvailableActions(): string[] {
       return Array.from(this.registry.keys());
     }
     
     resolveActionName(input: string): string | undefined {
       // Check direct match
       if (this.registry.has(input)) return input;
       
       // Check aliases
       for (const [name, metadata] of this.registry) {
         if (metadata.aliases.includes(input)) return name;
       }
       
       return undefined;
     }
   }
   ```

### Phase 3: Refactor Components

3. **Refactor adapter.ts**
   - Replace hard-coded methods with dynamic tool invocation
   - Use discovery service to find tools
   ```typescript
   class McpAdapter {
     constructor(
       private mcp: MCP,
       private discoveryService: McpToolDiscoveryService,
       private actionRegistry: ActionRegistry
     ) {}
     
     async invokeAction(actionName: string, args: any): Promise<any> {
       const resolvedName = this.actionRegistry.resolveActionName(actionName);
       if (!resolvedName) {
         throw new Error(`Unknown action: ${actionName}`);
       }
       
       const tool = await this.discoveryService.getToolByName(resolvedName);
       if (!tool) {
         throw new Error(`Tool not found: ${resolvedName}`);
       }
       
       return this.mcp.callTool(tool.name, args);
     }
   }
   ```

4. **Refactor Prompt Generators**
   - Replace hard-coded action lists with dynamic lists
   ```typescript
   function generatePrompt(actionRegistry: ActionRegistry): string {
     const actions = actionRegistry.getAvailableActions();
     const actionList = actions.map(a => `- ${a}`).join('\n');
     
     return `Available actions:\n${actionList}\n\n...`;
   }
   ```

5. **Remove Duplicate Action Mappings**
   - Consolidate all action mappings into ActionRegistry
   - Remove actionMapping objects from enhanced-step-executor.ts and enhanced-langgraph-workflow.ts

### Phase 4: Add Configuration Support

6. **Create Configuration for Legacy Support** (`packages/telegram-bot/src/config/mcp-actions.config.ts`)
   ```typescript
   export const MCP_ACTION_CONFIG = {
     aliasMapping: {
       // Legacy snake_case to camelCase mappings
       'list_todos': 'listTodos',
       'create_todo': 'createTodo',
       'update_todo': 'updateTodo',
       'delete_todo': 'deleteTodo',
       'toggle_completion': 'toggleTodoCompletion',
       'start_time_tracking': 'startTimeTracking',
       'stop_time_tracking': 'stopTimeTracking',
       'get_active_timers': 'getActiveTimeTracking',
     },
     
     // Tool name variations for backward compatibility
     toolVariants: {
       'createTodo': ['createTodo', 'create', 'addTodo'],
       'listTodos': ['listTodos', 'list', 'getTodos'],
       // ... etc
     }
   };
   ```

### Phase 5: Testing & Migration

7. **Create Tests**
   - Unit tests for ToolDiscoveryService
   - Unit tests for ActionRegistry
   - Integration tests for dynamic tool invocation
   - Tests for legacy name resolution

8. **Migration Strategy**
   - Implement discovery service with fallback to hard-coded list
   - Gradually migrate each component
   - Maintain backward compatibility during transition
   - Remove hard-coded lists after full migration

## Benefits

1. **Dynamic Discovery**: Automatically discover new MCP tools without code changes
2. **Single Source of Truth**: Centralized action management
3. **Maintainability**: Easier to add/modify tool support
4. **Extensibility**: Support for multiple MCP servers with different tool sets
5. **Consistency**: Unified naming and action resolution

## Implementation Timeline

- **Week 1**: Implement ToolDiscoveryService and ActionRegistry
- **Week 2**: Refactor adapter.ts and add tests
- **Week 3**: Update prompt generators and remove duplicated mappings
- **Week 4**: Testing, documentation, and rollout

## Risks & Mitigations

1. **Breaking Changes**: Mitigated by maintaining alias support for legacy names
2. **Performance**: Mitigated by caching discovered tools
3. **MCP Server Compatibility**: Mitigated by fallback to configured defaults
4. **Tool Discovery Failures**: Mitigated by graceful degradation to cached/configured tools

## Success Criteria

- [ ] All hard-coded action lists removed
- [ ] Dynamic tool discovery working with test MCP server
- [ ] All existing functionality maintained
- [ ] Performance metrics remain unchanged
- [ ] Zero breaking changes for existing integrations