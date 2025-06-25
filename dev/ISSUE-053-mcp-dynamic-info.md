# Issue #51: Refactor Hard-coded MCP Actions to Dynamic Info Generation

## Problem Statement

Currently, the enhanced intent analyzer in `packages/telegram-bot/src/agent/nodes/enhanced-intent-analyzer.ts` contains hard-coded MCP action descriptions and parameters (lines 34-105). This creates maintenance overhead and potential inconsistencies when the MCP server capabilities change.

## Current Implementation

### Hard-coded MCP Actions Location
- **File**: `packages/telegram-bot/src/agent/nodes/enhanced-intent-analyzer.ts`
- **Lines**: 34-105 in the `analysisPrompt` string
- **Content**: Static descriptions of 8 MCP tools with detailed parameter specifications

### Existing Dynamic Solution
The response generator already implements dynamic MCP info retrieval:
- **File**: `packages/telegram-bot/src/ai/response-generator.ts`
- **Lines**: 65-86
- **Method**: Uses `mcpClient.getServerInfo('all')` with fallback handling

## Proposed Solution

### 1. Create Shared MCP Info Service

**New file**: `packages/telegram-bot/src/mcp/info-service.ts`

```typescript
export interface MCPToolInfo {
  name: string;
  description: string;
  parameters: Record<string, any>;
  examples?: string[];
}

export interface MCPInfoService {
  getMCPToolsInfo(mcpClient: MCPClient): Promise<MCPToolInfo[]>;
  formatMCPInfoForPrompt(toolsInfo: MCPToolInfo[]): Promise<string>;
  formatMCPInfoForIntentAnalysis(toolsInfo: MCPToolInfo[]): Promise<string>;
}
```

### 2. Refactor Enhanced Intent Analyzer

**Target**: `packages/telegram-bot/src/agent/nodes/enhanced-intent-analyzer.ts`

**Changes**:
- Replace hard-coded MCP actions (lines 34-105) with dynamic generation
- Add MCP client dependency injection
- Implement fallback mechanism when MCP server unavailable
- Cache MCP info for session performance

**Implementation Pattern**:
```typescript
async function analyzeIntent(state: EnhancedWorkflowStateType): Promise<Partial<EnhancedWorkflowStateType>> {
  // Get dynamic MCP info
  const mcpInfo = await getMCPInfoForIntentAnalysis(mcpClient);
  
  const analysisPrompt = `Analyze the user's intent and classify the task complexity for a todo management system with MCP integration.

User Intent: "${state.userIntent}"

${mcpInfo}

IMPORTANT: For createTodo actions, use semantic understanding...
`;
}
```

### 3. Update Response Generator (Optional)

**Target**: `packages/telegram-bot/src/ai/response-generator.ts`

**Changes**:
- Optionally refactor to use shared `info-service.ts`
- Maintain existing fallback behavior
- Keep current caching strategy

## Implementation Plan

### Phase 1: Create Shared Service
1. **Create** `packages/telegram-bot/src/mcp/info-service.ts`
2. **Extract** MCP info formatting logic from existing implementations
3. **Implement** caching mechanism for performance
4. **Add** comprehensive error handling and fallbacks

### Phase 2: Refactor Intent Analyzer
1. **Update** `enhanced-intent-analyzer.ts` to use dynamic MCP info
2. **Replace** hard-coded prompt section (lines 34-105)
3. **Add** MCP client parameter to `analyzeIntent` function
4. **Implement** fallback to minimal prompt when MCP unavailable

### Phase 3: Testing & Validation
1. **Test** intent analysis with dynamic MCP info
2. **Verify** fallback behavior when MCP server down
3. **Validate** prompt formatting maintains existing functionality
4. **Performance** test caching mechanism

### Phase 4: Optional Consolidation
1. **Evaluate** refactoring response generator to use shared service
2. **Maintain** backward compatibility
3. **Document** new architecture patterns

## Benefits

### Immediate Benefits
- **Eliminates duplication**: Single source of truth for MCP tool information
- **Automatic synchronization**: Changes to MCP server automatically reflected
- **Reduced maintenance**: No manual updates needed when tools change
- **Consistency**: Same tool descriptions across all components

### Long-term Benefits
- **Extensibility**: Easy to add new MCP servers or tools
- **Reliability**: Centralized error handling and fallback mechanisms
- **Performance**: Intelligent caching reduces redundant MCP calls
- **Developer experience**: Clear separation of concerns

## Technical Considerations

### Dependencies
- **MCP Client**: Requires access to connected MCP client instance
- **Error Handling**: Must handle MCP server unavailability gracefully
- **Performance**: Caching strategy to avoid repeated expensive calls
- **TypeScript**: Maintain strict typing for tool schemas

### Backward Compatibility
- **Fallback mechanism**: Continue working when MCP server unavailable
- **Existing interfaces**: Maintain current function signatures where possible
- **Graceful degradation**: Reduced functionality instead of complete failure

### Testing Strategy
- **Unit tests**: Test info service functions independently
- **Integration tests**: Test with real MCP server connections
- **Fallback tests**: Verify behavior when MCP server unreachable
- **Performance tests**: Validate caching effectiveness

## Files Affected

### New Files
- `packages/telegram-bot/src/mcp/info-service.ts`

### Modified Files
- `packages/telegram-bot/src/agent/nodes/enhanced-intent-analyzer.ts`
- `packages/telegram-bot/src/ai/response-generator.ts` (optional)

### Related Files (Reference)
- `packages/server/src/mcp-server.ts` (MCP server implementation)
- `packages/telegram-bot/src/mcp/enhanced-client.ts` (MCP client)
- `packages/telegram-bot/src/mcp/adapter.ts` (MCP adapter)

## Success Criteria

1. **Functionality**: Intent analysis works identically with dynamic MCP info
2. **Reliability**: Graceful fallback when MCP server unavailable
3. **Performance**: No significant impact on response times
4. **Maintainability**: Single location for MCP tool documentation
5. **Extensibility**: Easy to add new MCP tools without code changes

## Risk Mitigation

### Risk: MCP Server Unavailability
**Mitigation**: Robust fallback mechanism with cached/static minimal info

### Risk: Performance Impact
**Mitigation**: Intelligent caching and async loading strategies

### Risk: Breaking Changes
**Mitigation**: Maintain existing interfaces and comprehensive testing

### Risk: Complexity Increase
**Mitigation**: Clear documentation and simple, focused service design