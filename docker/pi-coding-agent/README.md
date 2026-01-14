# Pi Coding Agent Docker Image

Isolated Docker container for running [@mariozechner/pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) in RPC mode.

## Why Docker?

Pi-coding-agent has full bash access and can read/write files. Running it in a Docker container provides:

- **Filesystem isolation**: Agent can only access mounted directories
- **Network isolation**: Runs in dedicated `eddo-chat` network
- **Resource limits**: Memory and CPU constraints
- **Security**: Non-root user, minimal attack surface

## Build

Build from repository root (required for COPY commands):

```bash
docker build -t pi-coding-agent:latest -f docker/pi-coding-agent/Dockerfile .
```

## Usage

The container runs `pi --mode rpc --session-dir /sessions --no-session` by default.

### Basic test

```bash
# Interactive test (stdin/stdout)
docker run -i --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  pi-coding-agent:latest
```

Then send JSON-RPC commands:

```json
{ "type": "prompt", "message": "Hello, what can you do?" }
```

### With workspace mount

```bash
docker run -i --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v /path/to/repo:/workspace:rw \
  -v /path/to/sessions:/sessions:rw \
  pi-coding-agent:latest
```

### With auth.json

```bash
docker run -i --rm \
  -v ~/.pi/agent/auth.json:/home/agent/.pi/agent/auth.json:ro \
  -v /path/to/repo:/workspace:rw \
  pi-coding-agent:latest
```

## RPC Protocol

See [pi-coding-agent RPC documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md).

### Commands

```json
{"type":"prompt","message":"Your prompt here"}
{"type":"abort"}
```

### Events (stdout)

The agent streams JSON events:

- `message_start`, `message_update`, `message_end`
- `tool_start`, `tool_update`, `tool_end`
- `agent_end`

## Environment Variables

| Variable              | Description                                         |
| --------------------- | --------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | Anthropic API key                                   |
| `OPENAI_API_KEY`      | OpenAI API key                                      |
| `GEMINI_API_KEY`      | Google Gemini API key                               |
| `PI_CODING_AGENT_DIR` | Config directory (default: `/home/agent/.pi/agent`) |

## Volumes

| Path                              | Description                              |
| --------------------------------- | ---------------------------------------- |
| `/workspace`                      | Working directory (mount your repo here) |
| `/sessions`                       | Session storage for JSONL files          |
| `/home/agent/.pi/agent/auth.json` | API key configuration                    |

## Included Skills and Extensions

The image includes Eddo-specific skills and extensions from `packages/chat-agent/`:

### Skills

Located at `/home/agent/.pi/agent/skills/`:

- **eddo-todo**: GTD-style todo management via Eddo MCP server
- **eddo-work**: Structured work phases (REFINE → IMPLEMENT → REVIEW → COMPLETE)

### Extensions

Located at `/home/agent/.pi/agent/extensions/`:

- **graphviz-chart.ts**: Render Graphviz DOT specifications
- **vega-chart.ts**: Render Vega-Lite chart specifications

### MCP Server Access

The eddo-todo skill needs to reach the Eddo MCP server on the host:

```bash
docker run -i --rm \
  -e EDDO_MCP_URL=http://host.docker.internal:3001/mcp \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  pi-coding-agent:latest
```

**Note**: `host.docker.internal` works on Docker Desktop. For Linux, add `--add-host=host.docker.internal:host-gateway`.

## Security Notes

- Runs as non-root `agent` user
- Minimal base image (node:22-slim)
- Only essential tools installed
- Network isolated via Docker network
