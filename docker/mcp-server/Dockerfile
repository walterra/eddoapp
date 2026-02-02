FROM node:22-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages/core-instrumentation/package.json ./packages/core-instrumentation/
COPY packages/core-shared/package.json ./packages/core-shared/
COPY packages/core-server/package.json ./packages/core-server/
COPY packages/mcp_server/package.json ./packages/mcp_server/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @eddo/core-shared build
RUN pnpm --filter @eddo/core-server build
RUN pnpm --filter @eddo/core-instrumentation build
RUN pnpm --filter @eddo/mcp-server build

FROM node:22-alpine AS production

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages/core-instrumentation/package.json ./packages/core-instrumentation/
COPY packages/core-shared/package.json ./packages/core-shared/
COPY packages/core-server/package.json ./packages/core-server/
COPY packages/mcp_server/package.json ./packages/mcp_server/

ENV HUSKY=0
ENV NPM_CONFIG_IGNORE_SCRIPTS=1
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/core-instrumentation/dist ./packages/core-instrumentation/dist
COPY --from=builder /app/packages/core-shared/dist ./packages/core-shared/dist
COPY --from=builder /app/packages/core-server/dist ./packages/core-server/dist
COPY --from=builder /app/packages/mcp_server/dist ./packages/mcp_server/dist

RUN addgroup -g 1001 -S nodejs
RUN adduser -S eddo -u 1001
RUN chown -R eddo:nodejs /app
USER eddo

EXPOSE 3001

CMD ["pnpm", "--filter", "@eddo/mcp-server", "start"]
