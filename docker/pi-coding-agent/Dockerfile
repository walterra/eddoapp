# Pi Coding Agent Docker Image
# Isolated container for running @mariozechner/pi-coding-agent in RPC mode
#
# Build: docker build -t pi-coding-agent:latest .
# Run:   docker run -i --rm pi-coding-agent:latest

FROM node:22-slim

# Install essential tools for coding agent
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    curl \
    jq \
    ripgrep \
    fd-find \
    tree \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s $(which fdfind) /usr/local/bin/fd

# Install pi-coding-agent globally
RUN npm install -g @mariozechner/pi-coding-agent

# Create non-root user for security
RUN useradd -m -s /bin/bash agent \
    && mkdir -p /workspace /sessions /home/agent/.pi/agent \
    && chown -R agent:agent /workspace /sessions /home/agent

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

# Entry point: run pi in RPC mode
# API keys should be passed via environment variables or mounted auth.json
ENTRYPOINT ["pi", "--mode", "rpc", "--session-dir", "/sessions", "--no-session"]
