# Issue #037: Telegram Bot with MCP Server Integration

**Created:** 2025-06-23  
**Status:** Pending  
**Priority:** Medium  
**Category:** New Feature  
**Estimated Effort:** 2-3 weeks  

## Overview

Create a Telegram bot that acts as a personal digital butler/assistant, integrating with the existing MCP (Model Context Protocol) server to provide intelligent task management and todo assistance. The bot should leverage the existing PouchDB-based todo system while providing a conversational interface for users.

## Context & Inspiration

Based on analysis of the `/Users/walterra/dev/concierge` reference implementation and insights from Geoffrey Litt's AI assistant architecture, this bot should follow the principle of "small tools operating on a shared pool of context" while maintaining simplicity and effectiveness.

## Requirements

### 1. Core Architecture

#### **MCP Integration**
- Connect to existing MCP server (from ISSUE-041) as a client
- Use MCP protocol for all todo/task operations instead of direct database access
- Leverage MCP tools for:
  - Creating, reading, updating, deleting todos
  - Querying tasks by context, due date, status
  - Time tracking operations
  - Weekly/daily task summaries

#### **Technology Stack**
- **Runtime:** Node.js with TypeScript
- **Bot Framework:** Grammy (Telegram bot framework)
- **MCP Client:** Official MCP SDK for Node.js
- **AI Integration:** Claude Code SDK (enhanced capabilities beyond standard Anthropic SDK)
- **Database:** Access existing PouchDB via MCP server (no direct database access)
- **Build Tool:** Vite with TypeScript support
- **Package Manager:** pnpm (consistent with main project)

### 2. Bot Personality & UX

#### **Digital Butler Persona**
- Professional, helpful butler personality (inspired by "Mr. Stevens" concept)
- Formal but friendly communication style
- Proactive assistance and gentle reminders
- Context-aware responses based on user's todo history

#### **Conversational Interface**
- Natural language processing for todo management:
  - "Add 'buy groceries' to my work context for tomorrow"
  - "What do I have due this week?"
  - "Start timer for current task"
  - "Show me my work todos"
- Smart parsing of dates, contexts, and priorities
- Confirmation prompts for destructive operations

### 3. Core Features

#### **Todo Management via MCP**
- **Create Todos:** Parse natural language to extract title, context, due date, tags
- **Query Todos:** Support filtering by context, date range, completion status
- **Update Todos:** Modify existing todos with conversational commands
- **Delete Todos:** Safe deletion with confirmation prompts
- **Batch Operations:** "Mark all overdue work tasks as completed"

#### **Time Tracking Integration**
- Start/stop/pause timers for active todos
- Query current active timers
- Generate time reports (daily/weekly summaries)
- Automatic time tracking suggestions

#### **Smart Notifications**
- Daily morning briefings (inspired by Stevens assistant)
- Overdue task reminders
- Weekly planning sessions
- Context-based reminders ("You have 3 work tasks for tomorrow")

#### **Data Insights**
- Weekly productivity summaries
- Context-based analytics ("This week you completed 8 work tasks")
- Time tracking reports
- Goal progress tracking

#### **Enhanced AI Capabilities (Claude Code SDK)**
- **Advanced Code Generation:** Generate todo templates, automation scripts, and data processing code
- **Multi-turn Conversations:** Maintain context across sessions for complex planning discussions
- **Tool Integration:** Leverage MCP tools through Claude Code's enhanced tool access system
- **Session Management:** Resume previous conversations and maintain user context
- **Custom System Prompts:** Tailored AI behavior for personal assistant use cases
- **Streaming Responses:** Real-time response generation for better user experience

### 4. Technical Implementation

#### **MCP Client Architecture**
```typescript
interface MCPBotClient {
  // Tool calls via MCP
  createTodo(params: CreateTodoParams): Promise<Todo>
  queryTodos(filters: TodoFilters): Promise<Todo[]>
  updateTodo(id: string, updates: Partial<Todo>): Promise<Todo>
  deleteTodo(id: string): Promise<void>
  
  // Time tracking
  startTimer(todoId: string): Promise<TimeEntry>
  stopTimer(todoId: string): Promise<TimeEntry>
  getCurrentTimers(): Promise<TimeEntry[]>
  
  // Analytics
  getWeeklySummary(weekStart: Date): Promise<WeeklySummary>
  getContextSummary(context: string): Promise<ContextSummary>
}
```

#### **Message Processing Pipeline**
```
Telegram Message → Claude Code SDK Session → Tool Permission Check → MCP Tool Selection → MCP Server Call → Streaming Response → Telegram Reply
```

#### **Claude Code SDK Integration**
```typescript
interface ClaudeCodeBotClient {
  // Enhanced AI conversation management
  startSession(userId: string, systemPrompt: string): Promise<SessionId>
  continueSession(sessionId: SessionId, message: string): AsyncIterator<Message>
  resumeSession(sessionId: SessionId): Promise<SessionContext>
  
  // Tool integration with permission controls
  registerMCPTools(mcpClient: MCPClient): Promise<void>
  setToolPermissions(permissions: ToolPermissions): void
  
  // Advanced response handling
  streamResponse(prompt: string, context: ConversationContext): AsyncIterator<ResponseChunk>
  generateStructuredOutput<T>(schema: Schema<T>, prompt: string): Promise<T>
}
```

#### **Intent Recognition System**
- **Claude Code SDK Sessions:** Maintain conversation context for natural multi-turn interactions
- **Structured Output Generation:** Use Zod schemas to extract todo parameters from natural language
- **Tool Permission System:** Granular control over which MCP tools the AI can access
- **Session Management:** Resume conversations across Telegram sessions for continuity
- **Streaming Responses:** Real-time typing indicators and progressive message updates

#### **Error Handling**
- Graceful MCP server connection failures
- User-friendly error messages
- Automatic retry logic for transient failures
- Fallback responses when MCP server is unavailable

### 5. Configuration & Deployment

#### **Environment Variables**
```bash
TELEGRAM_BOT_TOKEN=<bot_token_from_botfather>
ANTHROPIC_API_KEY=<claude_api_key>
MCP_SERVER_URL=<mcp_server_endpoint>
MCP_SERVER_AUTH=<mcp_auth_token>
CLAUDE_CODE_WORKING_DIR=<bot_working_directory>
CLAUDE_CODE_SESSION_TIMEOUT=3600
NODE_ENV=production|development
LOG_LEVEL=info|debug|error
```

#### **MCP Server Connection**
- Configurable MCP server endpoint
- Authentication via API keys or JWT tokens
- Connection pooling and retry logic
- Health check monitoring

#### **Deployment Options**
- **Development:** Local development with webhook tunneling (ngrok)
- **Production:** Cloud deployment (Railway, Fly.io, or similar)
- **Self-hosted:** Docker container with systemd service

### 6. Security Considerations

#### **Authentication & Authorization**
- User authentication via Telegram user ID
- Rate limiting to prevent abuse
- Input sanitization for all user messages
- MCP server authentication

#### **Data Privacy**
- No local data storage (all data via MCP server)
- Encrypted communication with MCP server
- User data isolation
- Audit logging for all operations

### 7. Integration Points

#### **Existing Eddo App**
- Share data model through MCP server
- Maintain data consistency between web app and bot
- Support for offline/online sync scenarios

#### **External Services (Future)**
- Google Calendar integration for due dates
- Weather API for context-aware reminders
- Email integration for task creation
- USPS tracking for package-related todos

### 8. Development Phases

#### **Phase 1: Core Bot Infrastructure (Week 1)**
- Set up Grammy bot framework
- Integrate Claude Code SDK with session management
- Implement MCP client connection with tool registration
- Basic message handling and streaming response system
- Environment configuration and permission setup

#### **Phase 2: Todo Management (Week 2)**
- Implement core CRUD operations via MCP tools
- Structured output generation using Zod schemas for todo parsing
- Multi-turn conversation support for complex todo creation
- Query system for retrieving todos with natural language
- Session persistence for continued interactions

#### **Phase 3: Advanced Features (Week 3)**
- Time tracking integration with session-aware reminders
- Smart notifications using conversation context
- Advanced AI-powered planning and scheduling assistance
- Weekly/daily summary reports with personalized insights
- Code generation for automation scripts and data exports

#### **Phase 4: Polish & Deployment (Week 4)**
- Comprehensive error handling
- Performance optimization
- Documentation and deployment guides
- Integration testing with existing Eddo app

### 9. Success Criteria

#### **Functional Requirements**
- [ ] Bot responds to all basic todo operations (create, read, update, delete)
- [ ] Natural language parsing works for common todo creation patterns
- [ ] Time tracking functionality integrates seamlessly
- [ ] Daily/weekly summary reports are generated accurately
- [ ] MCP server integration is stable and performant

#### **Non-Functional Requirements**
- [ ] Response time < 2 seconds for simple operations
- [ ] 99.9% uptime for production deployment
- [ ] Handles up to 100 concurrent users
- [ ] Comprehensive error handling with user-friendly messages
- [ ] Full test coverage for critical functionality

### 10. Files to Create

```
telegram-bot/
├── src/
│   ├── index.ts              # Main application entry
│   ├── bot/
│   │   ├── handlers/         # Message handlers
│   │   ├── middleware/       # Bot middleware
│   │   └── commands/         # Command implementations
│   ├── mcp/
│   │   ├── client.ts         # MCP client implementation
│   │   ├── tools.ts          # MCP tool wrappers
│   │   └── types.ts          # MCP type definitions
│   ├── ai/
│   │   ├── claude_code.ts    # Claude Code SDK integration
│   │   ├── sessions.ts       # Session management
│   │   ├── prompts.ts        # System prompts
│   │   ├── permissions.ts    # Tool permission management
│   │   └── schemas.ts        # Zod schemas for structured output
│   └── utils/
│       ├── logger.ts         # Logging utilities
│       ├── config.ts         # Configuration management
│       └── validation.ts     # Input validation
├── tests/                    # Test files
├── docs/                     # Documentation
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### 11. Dependencies

```json
{
  "dependencies": {
    "grammy": "^1.21.1",
    "@anthropic-ai/claude-code": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.4",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@types/jest": "^29.5.0"
  }
}
```

## Acceptance Criteria

1. **MCP Integration:** Bot successfully connects to MCP server and performs all todo operations via registered tools
2. **Claude Code SDK:** Session management, streaming responses, and structured output generation work seamlessly
3. **Natural Language:** Users can create todos using natural language with multi-turn conversation support
4. **Time Tracking:** Bot can start/stop timers and generate time reports with contextual awareness
5. **Notifications:** Daily briefings and overdue reminders work reliably with personalized context
6. **Error Handling:** Graceful degradation when MCP server is unavailable, with session recovery
7. **Performance:** Sub-2-second response times for simple operations, streaming for complex ones
8. **Security:** Proper authentication, tool permissions, and input validation implemented
9. **Session Continuity:** Conversations can be resumed across Telegram sessions
10. **Documentation:** Complete setup and usage documentation with Claude Code SDK integration guide

## Related Issues

- **ISSUE-041:** MCP server implementation (dependency)
- **ISSUE-038:** Backend architecture considerations

## Claude Code SDK Advantages

### **Enhanced Capabilities Beyond Standard Anthropic SDK**

1. **Session Management**
   - Persistent conversation context across Telegram sessions
   - Automatic session resumption for returning users
   - Context-aware responses that remember previous interactions

2. **Tool Integration System**
   - Seamless MCP tool registration and management
   - Granular permission controls for tool access
   - Built-in security validation for tool operations

3. **Structured Output Generation**
   - Type-safe data extraction using Zod schemas
   - Reliable parsing of complex todo parameters from natural language
   - Validation and error handling for structured data

4. **Advanced Response Handling**
   - Streaming responses for real-time user feedback
   - Async iterator support for progressive message updates
   - Abort controller integration for cancelled operations

5. **Professional AI Assistant Framework**
   - Purpose-built for building AI-powered applications
   - Multi-turn conversation support out of the box
   - Custom system prompt integration

### **Implementation Strategy**

The Claude Code SDK will serve as the core AI engine, with the following integration pattern:

```typescript
// Initialize Claude Code SDK with MCP tools
const claudeCode = new ClaudeCodeClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  workingDirectory: process.env.CLAUDE_CODE_WORKING_DIR,
  sessionTimeout: parseInt(process.env.CLAUDE_CODE_SESSION_TIMEOUT)
});

// Register MCP tools
await claudeCode.registerTools(mcpClient.getAvailableTools());

// Set tool permissions
claudeCode.setToolPermissions({
  'todo-create': ['telegram-user'],
  'todo-read': ['telegram-user'],
  'todo-update': ['telegram-user'],
  'todo-delete': ['telegram-user', 'requires-confirmation'],
  'time-tracking': ['telegram-user']
});
```

## Notes

- This bot should complement, not replace, the existing web application
- Focus on conversational UX rather than replicating web UI functionality
- Consider mobile-first design principles for Telegram interface
- Plan for future integrations with calendar, email, and other productivity tools
- **Claude Code SDK provides significant advantages over direct Anthropic API usage for this use case**

---

**Implementation Priority:** This issue should be tackled after ISSUE-041 (MCP implementation) is completed, as it depends on having a functional MCP server.