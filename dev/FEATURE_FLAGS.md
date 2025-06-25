# Feature Flags Documentation

This document describes all feature flags and configuration toggles available in the Telegram bot codebase.

## Environment Variable Feature Flags

### Workflow Control

#### `USE_LANGGRAPH`
- **Type**: Boolean
- **Default**: `true` (enabled unless explicitly set to `'false'`)
- **Location**: `packages/telegram-bot/src/agent/index.ts:31`
- **Purpose**: Controls whether to use LangGraph workflow instead of basic workflow
- **Usage**: `process.env.USE_LANGGRAPH !== 'false'`
- **Impact**: Determines the workflow engine used for processing user messages

#### `USE_ENHANCED_WORKFLOW`
- **Type**: Boolean
- **Default**: `true` (enabled unless explicitly set to `'false'`)
- **Location**: `packages/telegram-bot/src/agent/index.ts:32`
- **Purpose**: Controls whether to use enhanced LangGraph workflow vs simple LangGraph workflow
- **Usage**: `process.env.USE_ENHANCED_WORKFLOW !== 'false'`
- **Impact**: Enables Intent → Plan → Execute → Reflect pattern in enhanced workflow

#### `ENABLE_AGENT_WORKFLOW`
- **Type**: Boolean
- **Default**: `true` (enabled unless explicitly set to `'false'`)
- **Location**: `packages/telegram-bot/src/bot/handlers/enhanced-message.ts:137`
- **Purpose**: Controls whether to use agent workflow or fallback to original message handler
- **Usage**: `process.env.ENABLE_AGENT_WORKFLOW !== 'false'`
- **Impact**: Routes messages through agent workflow vs original handler

### Authentication

#### `MCP_API_KEY`
- **Type**: String (optional)
- **Default**: `undefined` (no authentication)
- **Location**: `packages/telegram-bot/src/mcp/enhanced-client.ts:53`
- **Purpose**: Optional authentication for MCP server API
- **Usage**: Adds Authorization header if present
- **Impact**: Enables authenticated MCP server connections

## Configuration Schema Variables

These are defined in `packages/telegram-bot/src/utils/config.ts`:

### `NODE_ENV`
- **Type**: Enum
- **Values**: `'development'`, `'production'`, `'test'`
- **Default**: `'development'`
- **Purpose**: Controls environment-specific behavior
- **Usage**: Affects logging transport configuration in `logger.ts:20`

### `LOG_LEVEL`
- **Type**: Enum
- **Values**: `'error'`, `'warn'`, `'info'`, `'debug'`
- **Default**: `'info'`
- **Purpose**: Controls logging verbosity
- **Usage**: Used by Winston logger configuration

### `BOT_PERSONA_ID`
- **Type**: String
- **Default**: `'butler'`
- **Purpose**: Controls which AI persona the bot uses
- **Usage**: Determines bot personality and response style

## Workflow Configuration Flags

These are boolean flags in the `WorkflowConfig` interface (`packages/telegram-bot/src/agent/types/workflow-types.ts`):

### `enableStreaming`
- **Type**: Boolean
- **Default**: `true`
- **Location**: Line 168
- **Purpose**: Controls whether workflow supports streaming responses
- **Usage**: Configured in agent initialization

### `enableApprovals`
- **Type**: Boolean
- **Default**: `true`
- **Location**: Line 169
- **Purpose**: Controls whether workflow requires user approvals for destructive operations
- **Usage**: Used throughout workflow nodes for approval routing

## Hardcoded Feature Toggles

### Console Logging Toggle
- **Location**: `packages/telegram-bot/src/utils/logger.ts:20`
- **Condition**: `appConfig.NODE_ENV !== 'production'`
- **Purpose**: Enables console logging in non-production environments
- **Impact**: Adds colorized console output for development

### Workflow Fallback Logic
- **Location**: `packages/telegram-bot/src/agent/index.ts:31-65`
- **Purpose**: Progressive fallback from Enhanced → Simple → Basic workflows
- **Impact**: Provides graceful degradation if advanced features fail

## Development/Debug Features

### Workflow Resume Token
- **Location**: `packages/telegram-bot/src/bot/commands/start.ts:183`
- **Token**: `'__RESUME_WORKFLOW__'`
- **Purpose**: Special internal message to resume paused workflows
- **Usage**: Used by approval commands to continue interrupted workflows

## Configuration Constants

### MCP Action Aliases
- **Location**: `packages/telegram-bot/src/config/mcp-actions.config.ts`
- **Purpose**: Maps legacy snake_case action names to camelCase for backward compatibility
- **Usage**: Allows flexible action naming across different integrations

### Tool Variants
- **Location**: Same file as above
- **Purpose**: Maps action names to multiple possible tool name variations
- **Usage**: Provides fallback tool resolution for different MCP server implementations

## Removed/Deprecated Flags

### Enhanced MCP Feature Flag
- **Location**: `packages/telegram-bot/src/mcp/enhanced-client.ts:211`
- **Status**: **REMOVED** - Comment indicates "Feature flag removed - always use enhanced MCP with @langchain/mcp-adapters"
- **Previous Purpose**: Controlled whether to use enhanced MCP integration
- **Current State**: Always enabled

## Usage Examples

### Setting Feature Flags

```bash
# Disable LangGraph workflow (use basic workflow)
export USE_LANGGRAPH=false

# Disable enhanced workflow (use simple LangGraph)
export USE_ENHANCED_WORKFLOW=false

# Disable agent workflow (use original message handler)
export ENABLE_AGENT_WORKFLOW=false

# Set MCP authentication
export MCP_API_KEY=your-api-key-here

# Set environment and logging
export NODE_ENV=production
export LOG_LEVEL=warn

# Set bot persona
export BOT_PERSONA_ID=assistant
```

### Progressive Fallback Chain

The system implements a progressive enhancement approach:

1. **Enhanced Workflow** (if `USE_ENHANCED_WORKFLOW=true`)
   - Intent → Plan → Execute → Reflect pattern
   - Multi-server MCP support
   - Advanced error handling

2. **Simple LangGraph Workflow** (if `USE_LANGGRAPH=true` but enhanced disabled)
   - Basic LangGraph implementation
   - Single-step execution

3. **Basic Workflow** (if LangGraph disabled)
   - Original message handler
   - Direct MCP client usage

## Best Practices

1. **Default to Enabled**: Most feature flags default to enabled to provide the best user experience
2. **Graceful Degradation**: System should work even if advanced features are disabled
3. **Environment Awareness**: Use `NODE_ENV` to automatically adjust behavior for development vs production
4. **Logging**: Use `LOG_LEVEL` to control verbosity appropriate for the environment
5. **Testing**: Set flags appropriately in test environments to ensure consistent behavior

## Monitoring

Monitor the following when feature flags are changed:

- **Performance Impact**: Enhanced workflows may have higher latency
- **Error Rates**: Basic workflows may have less robust error handling
- **User Experience**: Different workflows provide different interaction patterns
- **Resource Usage**: Enhanced features may consume more memory/CPU

## Future Considerations

- Consider implementing a centralized feature flag service for runtime toggling
- Add telemetry to track feature flag usage and performance impact
- Implement gradual rollout mechanisms for new features
- Add feature flag validation to prevent invalid configurations