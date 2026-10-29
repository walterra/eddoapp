# Pi Coding Agent Docker Image
# Isolated container for running @mariozechner/pi-coding-agent in RPC mode
#
# Build: docker build -t pi-coding-agent:latest -f docker/pi-coding-agent/Dockerfile .
# Run:   docker run -i --rm pi-coding-agent:latest

# Build the todo skill independently of workspace dependencies.
FROM node:22-slim AS eddo-todo-skill
WORKDIR /opt/eddo-todo
COPY packages/chat-agent/skills/eddo-todo/package.json packages/chat-agent/skills/eddo-todo/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY packages/chat-agent/skills/eddo-todo/eddo-todo.js packages/chat-agent/skills/eddo-todo/eddo.js packages/chat-agent/skills/eddo-todo/mcp_client.js packages/chat-agent/skills/eddo-todo/eddo-worktree.js packages/chat-agent/skills/eddo-todo/SKILL.md ./
RUN node eddo-todo.js --help >/dev/null && node eddo.js --help >/dev/null

FROM node:22-slim AS runtime

# Install essential tools for coding agent
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    curl \
    jq \
    ripgrep \
    fd-find \
    tree \
    graphviz \
    python3 \
    python3-pip \
    ca-certificates \
    gpg \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s $(which fdfind) /usr/local/bin/fd

# Install GitHub CLI (gh)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages for vega-chart extension
RUN pip3 install --break-system-packages altair pandas vl-convert-python

# Install pi-coding-agent globally
RUN npm install -g @mariozechner/pi-coding-agent

# Create non-root user for security
RUN useradd -m -s /bin/bash agent \
    && mkdir -p /workspace /sessions /home/agent/.pi/agent/skills /home/agent/.pi/agent/extensions \
    && chown -R agent:agent /workspace /sessions /home/agent

# Copy skills, extensions, and agent instructions (as root, then fix ownership)
COPY --chown=agent:agent packages/chat-agent/skills/ /home/agent/.pi/agent/skills/
COPY --chown=agent:agent packages/chat-agent/extensions/ /home/agent/.pi/agent/extensions/
COPY --chown=agent:agent packages/chat-agent/AGENTS.md /home/agent/.pi/agent/AGENTS.md

# Install skill dependencies
COPY --from=eddo-todo-skill --chown=agent:agent /opt/eddo-todo/ /home/agent/.pi/agent/skills/eddo-todo/

WORKDIR /home/agent/.pi/agent/skills/searxng-search
RUN npm install --omit=dev

# Switch to non-root user
USER agent
WORKDIR /workspace

# Configure git for the agent user (needed for worktree operations)
RUN git config --global user.email "agent@eddo.local" \
    && git config --global user.name "Eddo Agent" \
    && git config --global init.defaultBranch main \
    && git config --global safe.directory '*'

# Default environment variables
ENV NODE_ENV=production
ENV PI_CODING_AGENT_DIR=/home/agent/.pi/agent
# SearXNG URL for web search (container networking)
ENV SEARXNG_URL=http://searxng:8080

# Entry point: run pi in RPC mode
# API keys should be passed via environment variables or mounted auth.json
ENTRYPOINT ["pi", "--mode", "rpc", "--session-dir", "/sessions", "--no-session"]
