# MCP Handshake & Session Management Improvement Plan

## Current State Analysis

Based on analysis of the telegram bot (`packages/telegram-bot`) and MCP server (`packages/server`) implementations, several critical gaps exist in the MCP interplay that impact reliability and capability discovery.

### Current Implementation Issues

1. **Incomplete MCP Handshake**
   - Bot uses lazy initialization - MCP client only connects on first message
   - Missing proper three-phase MCP initialization sequence
   - No client capability advertisement to server
   - Server never receives `initialized` notification

2. **Session Management Problems**
   - No persistent connection - recreated for each operation
   - No connection health monitoring or heartbeat
   - Missing reconnection logic for network failures
   - No connection state tracking

3. **Limited Capability Discovery**
   - System prompt only includes tool names and descriptions
   - Missing full JSON schemas for better LLM understanding
   - No tool categorization or usage examples
   - No dynamic capability updates when server changes

4. **Error Handling Gaps**
   - Basic error recovery in agent loop
   - No graceful degradation when capabilities change
   - Missing connection failure handling

## Improvement Plan

### Phase 1: Proper MCP Handshake (High Priority)

**Objective**: Implement complete MCP protocol initialization sequence

**Changes Required**:
- Modify `packages/telegram-bot/src/mcp/client.ts` to implement full handshake:
  ```typescript
  // 1. Send initialize request with client capabilities
  const initResult = await client.initialize({
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      sampling: {}
    },
    clientInfo: {
      name: "eddo-telegram-bot",
      version: "1.0.0"
    }
  });
  
  // 2. Process server capabilities response
  const serverCapabilities = initResult.capabilities;
  
  // 3. Send initialized notification
  await client.initialized();
  ```

- Move connection from lazy to eager initialization at bot startup
- Add proper error handling for handshake failures
- Log handshake success/failure for debugging

**Expected Benefits**:
- Reliable MCP connection establishment
- Proper protocol compliance
- Better error diagnostics

### Phase 2: Session Persistence & Health (Medium Priority)

**Objective**: Maintain persistent, healthy MCP connections

**Changes Required**:
- Implement connection pooling/reuse patterns
- Add connection health monitoring:
  ```typescript
  class MCPConnectionManager {
    private connection: Client;
    private healthCheckInterval: NodeJS.Timeout;
    
    async initialize() {
      await this.establishConnection();
      this.startHealthCheck();
    }
    
    private startHealthCheck() {
      this.healthCheckInterval = setInterval(async () => {
        try {
          await this.connection.ping();
        } catch (error) {
          await this.reconnect();
        }
      }, 30000); // 30-second health check
    }
  }
  ```

- Implement automatic reconnection with exponential backoff
- Add connection state tracking and metrics

**Expected Benefits**:
- Reduced connection overhead
- Automatic recovery from network issues
- Better connection reliability

### Phase 3: Enhanced System Prompt Generation (Medium Priority)

**Objective**: Provide richer capability information to the LLM

**Changes Required**:
- Modify `packages/telegram-bot/src/agent/system-prompt.ts` to include:
  - Full JSON schemas for tool parameters
  - Tool categorization (CRUD, Time Tracking, Utilities)
  - Usage examples from server metadata
  - Parameter validation rules

- Enhanced tool discovery in MCP client:
  ```typescript
  const tools = await client.listTools();
  const enrichedTools = tools.tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    category: categorizeToolByName(tool.name),
    examples: extractExamplesFromDescription(tool.description)
  }));
  ```

**Expected Benefits**:
- Better LLM understanding of tool capabilities
- More accurate parameter passing
- Improved tool selection by LLM

### Phase 4: Dynamic Capability Management (Low Priority)

**Objective**: Handle server capability changes dynamically

**Changes Required**:
- Implement `listChanged` notification handling
- Add system prompt regeneration on capability updates:
  ```typescript
  client.onNotification('notifications/tools/list_changed', async () => {
    await this.refreshCapabilities();
    await this.updateSystemPrompt();
  });
  ```

- Cache tool metadata with proper invalidation
- Add graceful degradation when capabilities are removed

**Expected Benefits**:
- Automatic adaptation to server changes
- No bot restart required for capability updates
- Better user experience with latest capabilities

## Implementation Strategy

### Development Approach
1. **Incremental Changes**: Implement phases sequentially to maintain stability
2. **Backward Compatibility**: Ensure changes don't break existing functionality
3. **Testing First**: Add comprehensive tests before implementation
4. **Monitoring**: Add logging and metrics for each improvement

### Testing Requirements
- Unit tests for MCP handshake sequence
- Integration tests for connection persistence
- End-to-end tests for capability discovery
- Load testing for connection health under stress

### Rollout Plan
1. **Development Environment**: Test all changes locally
2. **Staging Deployment**: Validate in production-like environment
3. **Gradual Rollout**: Deploy phase by phase with monitoring
4. **Rollback Plan**: Maintain ability to revert each phase independently

## Expected Outcomes

### Performance Improvements
- **Connection Overhead**: 60-70% reduction in connection establishment time
- **Capability Discovery**: Sub-second tool discovery vs current multi-second delays
- **Memory Usage**: Stable memory footprint with proper connection pooling

### Reliability Improvements
- **Uptime**: Near 100% MCP connectivity with auto-reconnection
- **Error Recovery**: Graceful handling of server unavailability
- **Protocol Compliance**: Full MCP specification adherence

### User Experience Improvements
- **Response Time**: Faster bot responses due to persistent connections
- **Capability Awareness**: LLM better understands available tools
- **Error Messages**: More informative error reporting to users

### Maintenance Benefits
- **Debugging**: Better connection state visibility
- **Monitoring**: Comprehensive metrics for MCP health
- **Scalability**: Foundation for multiple MCP server support

## Risk Mitigation

### Technical Risks
- **Connection Leaks**: Implement proper connection cleanup
- **Memory Leaks**: Monitor connection pool size and health
- **Protocol Changes**: Version compatibility checks in handshake

### Operational Risks
- **Deployment Issues**: Comprehensive testing and gradual rollout
- **Performance Regression**: Baseline metrics before changes
- **Backward Compatibility**: Maintain fallback to current implementation

## Success Metrics

### Quantitative Metrics
- Connection establishment time < 1 second
- Connection success rate > 99.5%
- Tool discovery time < 500ms
- Memory usage stable over 24-hour periods

### Qualitative Metrics
- Improved LLM tool selection accuracy
- Better error messages and debugging
- Reduced connection-related support issues
- Enhanced developer experience working with MCP

## Timeline

- **Phase 1**: 2-3 days (handshake implementation)
- **Phase 2**: 3-4 days (session management)
- **Phase 3**: 2-3 days (system prompt enhancement)
- **Phase 4**: 2-3 days (dynamic capabilities)
- **Testing & Integration**: 2-3 days
- **Total Estimated Time**: 11-16 days

## Dependencies

### Internal Dependencies
- No breaking changes to MCP server API
- Telegram bot framework compatibility
- Shared type definitions consistency

### External Dependencies
- MCP SDK version compatibility
- Network infrastructure reliability
- Server deployment coordination

This plan provides a comprehensive roadmap for improving MCP handshake and session management while maintaining the project's philosophy of simplicity and reliability.