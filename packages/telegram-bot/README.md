# Eddo Telegram Bot

A sophisticated digital butler bot for Telegram that integrates with the Eddo todo management system via MCP (Model Context Protocol). Meet **Mr. Stevens**, your personal AI-powered task management assistant.

## Features

- **Natural Language Processing**: Talk to the bot naturally to manage your todos
- **MCP Integration**: Connects to the Eddo MCP server for all todo operations
- **AI-Powered Conversations**: Uses Claude AI for intelligent responses and context awareness
- **Time Tracking**: Start and stop timers for your tasks with voice commands
- **GTD-Style Contexts**: Organize todos by context (work, private, shopping, etc.)
- **Butler Personality**: Professional, courteous digital assistant experience
- **Session Management**: Maintains conversation context across interactions
- **Error Recovery**: Graceful handling of network issues and server outages

## Setup

### Prerequisites

- Node.js 18+ and pnpm
- Telegram account and mobile app
- Anthropic API Key (Claude AI)
- Running Eddo MCP Server (see `packages/server`)

### Step 1: Create Your Telegram Bot

1. **Open Telegram** and search for `@BotFather`
2. **Start a chat** with BotFather by clicking "Start" or sending `/start`
3. **Create a new bot** by sending `/newbot`
4. **Choose a name** for your bot (e.g., "Eddo Task Butler")
5. **Choose a username** for your bot (must end in 'bot', e.g., "eddo_task_butler_bot")
6. **Save the token** - BotFather will provide a token like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

#### Optional: Customize Your Bot

```
/setdescription - Set bot description
/setabouttext - Set about text
/setuserpic - Upload a profile picture
/setcommands - Set command menu
```

Example commands to set:

```
start - Welcome message and introduction
help - Show available commands and examples
status - Check bot and server status
```

### Step 2: Get Anthropic API Key

1. **Visit** [Anthropic Console](https://console.anthropic.com/)
2. **Sign up** or log in to your account
3. **Navigate to** API Keys section
4. **Create a new key** and copy it (starts with `sk-ant-`)
5. **Set usage limits** if desired for cost control

### Step 3: Installation & Configuration

1. **Install dependencies** from the repo root:

```bash
pnpm install
```

2. **Copy environment template**:

```bash
cp packages/telegram-bot/.env.example packages/telegram-bot/.env
```

3. **Configure your `.env` file** with your tokens:

```bash
# From BotFather (Step 1)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# From Anthropic Console (Step 2)
ANTHROPIC_API_KEY=sk-ant-api03-...

# MCP Server (should be running on port 3001, no auth required)
MCP_SERVER_URL=http://localhost:3001/mcp

# Optional: Adjust logging and environment
NODE_ENV=development
LOG_LEVEL=info
```

### Step 4: Start the System

1. **Start the MCP Server** (in one terminal):

```bash
pnpm dev:server
```

2. **Start the Telegram Bot** (in another terminal):

```bash
pnpm dev:telegram-bot
```

3. **Test your bot**:
   - Open Telegram
   - Search for your bot username (e.g., `@eddo_task_butler_bot`)
   - Send `/start` to begin

### Development

```bash
# Start in development mode (with hot reload)
pnpm dev

# Build for production
pnpm build

# Start production build
pnpm start

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Usage

### Getting Started

Once your bot is running, start a conversation:

1. **Find your bot** in Telegram (search for the username you created)
2. **Send `/start`** - Mr. Stevens will introduce himself
3. **Try some examples** below to see the magic happen!

### Basic Commands

- `/start` - Welcome message and introduction from Mr. Stevens
- `/help` - Comprehensive guide with examples and contexts
- `/status` - Check bot health and MCP server connection

### Natural Language Todo Management

**Creating Todos:**

```
"Add buy groceries to shopping for tomorrow"
"Create a work task to review quarterly reports by Friday"
"Remind me to call the dentist next Tuesday"
"Add 'finish project proposal' to work context with high priority tag"
```

**Viewing Todos:**

```
"Show me my work tasks"
"What do I have due this week?"
"List all my shopping items"
"What's overdue?"
"Show me everything in my private context"
```

**Completing & Managing:**

```
"Mark grocery shopping as completed"
"Mark 'finish proposal' as done"
"Delete the old meeting task"
"Move dentist appointment to next Friday"
```

**Time Tracking:**

```
"Start timer for meeting preparation"
"Begin timing the project work"
"Stop the current timer"
"How much time did I spend on work today?"
"Show me active timers"
```

**Getting Summaries:**

```
"Give me a summary of today's tasks"
"What did I accomplish this week?"
"Show me my productivity report"
"How many tasks do I have in each context?"
```

### Supported Contexts

- `work` - Professional tasks
- `private` - Personal tasks
- `shopping` - Shopping lists
- `errands` - Quick tasks to do
- `calls` - Phone calls to make
- `learning` - Educational tasks
- `health` - Health-related tasks
- `home` - Household tasks

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Telegram      │    │   Telegram Bot   │    │   MCP Server    │
│   User          │◄──►│   (Grammy)       │◄──►│   (FastMCP)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Claude AI      │
                       │   (Anthropic)    │
                       └──────────────────┘
```

### Key Components

- **Bot Framework**: Grammy for Telegram API
- **AI Processing**: Anthropic Claude for natural language understanding  
- **Agent Architecture**: Simple loop-based agent (replaced LangGraph for simplicity)
- **MCP Client**: Uses official @modelcontextprotocol/sdk for server communication
- **Tool Discovery**: Dynamic tool detection from MCP server
- **Error Handling**: Graceful degradation and retry logic

### Agent Architecture Details

The bot implements a simple agent loop that prioritizes clarity and AI-driven decisions:

1. **Receives user input** and creates conversation context
2. **Consults Claude AI** with system prompt containing available tool descriptions
3. **Parses tool calls** from AI responses using structured format (`TOOL_CALL: {...}`)
4. **Executes MCP tools** when requested and feeds results back to AI
5. **Returns final response** to user when AI decides no more tools are needed

This architecture replaces complex workflow frameworks (like LangGraph) with a minimal loop that trusts the LLM to orchestrate its own workflow, following the principle that "agents are just for loops with LLM calls".

## Configuration

### Environment Variables

| Variable             | Description               | Default                 |
| -------------------- | ------------------------- | ----------------------- |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | Required                |
| `ANTHROPIC_API_KEY`  | Claude API key            | Required                |
| `MCP_SERVER_URL`     | MCP server endpoint       | `http://localhost:3001` |
| `NODE_ENV`           | Environment               | `development`           |
| `LOG_LEVEL`          | Logging level             | `info`                  |

### MCP Server Connection

The bot connects to the MCP server using the official @modelcontextprotocol/sdk with HTTP streaming transport. The server requires:

- No authentication (uses CouchDB auth internally)
- Running on `http://localhost:3001/mcp`
- FastMCP server with httpStream transport

The MCP client automatically discovers available tools on startup and provides them to the Claude AI for natural language tool selection.

## Deployment

### Development

```bash
pnpm dev
```

### Production

```bash
pnpm build
pnpm start
```

### Docker (Future)

```bash
docker build -t eddo-telegram-bot .
docker run -d --env-file .env eddo-telegram-bot
```

## Troubleshooting

### Common Issues

#### 1. Bot Not Responding

**Symptoms**: Bot doesn't reply to messages, shows as offline
**Solutions**:

- Verify `TELEGRAM_BOT_TOKEN` is correct (check BotFather)
- Ensure bot is running (`pnpm dev:telegram-bot`)
- Check console for error messages
- Test token with: `curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe`

#### 2. "MCP Server Not Available" Errors

**Symptoms**: Bot responds but can't manage todos
**Solutions**:

- Start MCP server: `pnpm dev:server`
- Check MCP server is on port 3001: `curl http://localhost:3001/mcp`
- Verify CouchDB is running (see server package README)
- Check `MCP_SERVER_URL` in `.env`

#### 3. AI/Claude API Errors

**Symptoms**: Bot can't understand natural language, gives generic responses
**Solutions**:

- Verify `ANTHROPIC_API_KEY` is valid (starts with `sk-ant-`)
- Check API key has sufficient credits
- Test key independently: visit Anthropic Console
- Check network connectivity to Anthropic services

#### 4. Permission/Network Issues

**Symptoms**: Various connection timeouts
**Solutions**:

- Check firewall settings for ports 3001 and 5984 (CouchDB)
- Verify internet connectivity
- Try running with `NODE_ENV=development` for more logs
- Check corporate proxy settings if applicable

#### 5. Environment Configuration

**Symptoms**: "Configuration validation failed" on startup
**Solutions**:

- Ensure `.env` file exists in `packages/telegram-bot/`
- Check all required variables are set (see `.env.example`)
- Verify no extra spaces or quotes in `.env` values
- Use absolute paths if needed

### Debugging Tools

#### Enable Debug Logging

```bash
# In .env file
LOG_LEVEL=debug
NODE_ENV=development
```

#### Check Service Health

```bash
# Test MCP server
curl http://localhost:3001/mcp

# Test CouchDB
curl http://localhost:5984

# Test Telegram API
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
```

#### View Logs

```bash
# Real-time logs
tail -f packages/telegram-bot/combined.log

# Error logs only
tail -f packages/telegram-bot/error.log

# Or check console output
```

### Getting Help

If you're still having issues:

1. **Check logs** for specific error messages
2. **Verify all services** are running (CouchDB, MCP server, bot)
3. **Test each component** individually using the debugging tools above
4. **Search GitHub issues** for similar problems
5. **Create a new issue** with logs and configuration details

## Development Roadmap

### Phase 1: Core Infrastructure ✅

- [x] Grammy bot framework
- [x] MCP client integration (using official SDK)
- [x] Claude AI integration
- [x] Simple agent loop architecture
- [x] Dynamic tool discovery
- [x] Basic message handling

### Phase 2: Current Features ✅

- [x] Natural language todo management
- [x] Tool-based MCP server integration  
- [x] Comprehensive logging and debugging
- [x] Error handling and recovery
- [x] User-friendly typing indicators

### Phase 3: Future Enhancements

- [ ] Enhanced conversation memory
- [ ] Smart notifications
- [ ] Batch operations
- [ ] Docker deployment

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure MCP compatibility

## Quick Reference

### BotFather Commands

Create and manage your bot:

```
/newbot - Create a new bot
/setname - Change bot name
/setdescription - Set description
/setabouttext - Set about text
/setuserpic - Set profile picture
/setcommands - Set command menu
/deletebot - Delete bot
```

### Environment Variables

| Variable             | Required | Description    | Example                     |
| -------------------- | -------- | -------------- | --------------------------- |
| `TELEGRAM_BOT_TOKEN` | ✅       | From BotFather | `123456789:ABC...`          |
| `ANTHROPIC_API_KEY`  | ✅       | Claude AI key  | `sk-ant-api03-...`          |
| `MCP_SERVER_URL`     | ✅       | MCP endpoint   | `http://localhost:3001/mcp` |
| `NODE_ENV`           | ⚪       | Environment    | `development`               |
| `LOG_LEVEL`          | ⚪       | Logging level  | `info`                      |

### Service Dependencies

1. **CouchDB** (port 5984) - Database for todos
2. **MCP Server** (port 3001) - Todo operations API
3. **Telegram Bot** (your bot) - User interface
4. **Anthropic API** - AI processing

### Common Contexts

- `work` - Professional tasks and projects
- `private` - Personal tasks and reminders
- `shopping` - Shopping lists and errands
- `home` - Household tasks and maintenance
- `health` - Medical appointments and wellness
- `learning` - Educational goals and study tasks
- `calls` - Phone calls and communications
- `errands` - Quick tasks and outside activities

## License

MIT License - see the main project LICENSE file.
