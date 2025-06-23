# Eddo Telegram Bot

A sophisticated digital butler bot for Telegram that integrates with the Eddo todo management system via MCP (Model Context Protocol).

## Features

- **Natural Language Processing**: Talk to the bot naturally to manage your todos
- **MCP Integration**: Connects to the Eddo MCP server for all todo operations
- **AI-Powered Conversations**: Uses Claude AI for intelligent responses
- **Time Tracking**: Start and stop timers for your tasks
- **GTD-Style Contexts**: Organize todos by context (work, private, shopping, etc.)
- **Butler Personality**: Professional, helpful digital assistant experience

## Setup

### Prerequisites

- Node.js 18+ and pnpm
- Telegram Bot Token (from @BotFather)
- Anthropic API Key
- Running Eddo MCP Server (see `packages/server`)

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
ANTHROPIC_API_KEY=your_anthropic_api_key
MCP_SERVER_URL=http://localhost:3001
```

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

### Basic Commands

- `/start` - Welcome message and introduction
- `/help` - Show available commands and usage examples
- `/status` - Check bot and MCP server status

### Natural Language Examples

- "Add buy groceries to shopping for tomorrow"
- "Show me my work tasks"
- "What's due this week?"
- "Start timer for meeting preparation"
- "Mark grocery shopping as completed"
- "How much time did I spend on work today?"

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
- **MCP Client**: Connects to the Eddo MCP server for todo operations  
- **Session Management**: Maintains conversation context
- **Error Handling**: Graceful degradation and retry logic

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | Required |
| `ANTHROPIC_API_KEY` | Claude API key | Required |
| `MCP_SERVER_URL` | MCP server endpoint | `http://localhost:3001` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging level | `info` |

### MCP Server Connection

The bot connects to the MCP server to perform all todo operations. Ensure the MCP server is running before starting the bot.

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

1. **Bot not responding**: Check if `TELEGRAM_BOT_TOKEN` is correct
2. **MCP errors**: Ensure the MCP server is running on the correct port
3. **AI errors**: Verify `ANTHROPIC_API_KEY` is valid
4. **Connection issues**: Check network connectivity and firewall settings

### Logs

Logs are written to:
- Console (development)
- `combined.log` (all logs)
- `error.log` (errors only)

### Debug Mode

Set `LOG_LEVEL=debug` for detailed logging.

## Development Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Grammy bot framework
- [x] MCP client integration
- [x] Claude AI integration
- [x] Basic message handling

### Phase 2: Advanced Features (In Progress)
- [ ] Enhanced intent recognition
- [ ] Time tracking improvements
- [ ] Smart notifications
- [ ] Batch operations

### Phase 3: Polish & Deployment
- [ ] Comprehensive testing
- [ ] Docker deployment
- [ ] Performance optimization
- [ ] Documentation

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure MCP compatibility

## License

MIT License - see the main project LICENSE file.