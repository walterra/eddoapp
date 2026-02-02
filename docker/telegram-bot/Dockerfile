FROM node:22-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages/core-instrumentation/package.json ./packages/core-instrumentation/
COPY packages/core-shared/package.json ./packages/core-shared/
COPY packages/core-server/package.json ./packages/core-server/
COPY packages/printer_service/package.json ./packages/printer_service/
COPY packages/web-api/package.json ./packages/web-api/
COPY packages/telegram_bot/package.json ./packages/telegram_bot/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @eddo/core-shared build
RUN pnpm --filter @eddo/core-server build
RUN pnpm --filter @eddo/core-instrumentation build
RUN pnpm --filter @eddo/printer-service build
RUN pnpm --filter @eddo/web-api build
RUN pnpm --filter @eddo/telegram-bot build

FROM node:22-alpine AS production

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages/core-instrumentation/package.json ./packages/core-instrumentation/
COPY packages/core-shared/package.json ./packages/core-shared/
COPY packages/core-server/package.json ./packages/core-server/
COPY packages/printer_service/package.json ./packages/printer_service/
COPY packages/web-api/package.json ./packages/web-api/
COPY packages/telegram_bot/package.json ./packages/telegram_bot/

ENV HUSKY=0
ENV NPM_CONFIG_IGNORE_SCRIPTS=1
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/core-instrumentation/dist ./packages/core-instrumentation/dist
COPY --from=builder /app/packages/core-shared/dist ./packages/core-shared/dist
COPY --from=builder /app/packages/core-server/dist ./packages/core-server/dist
COPY --from=builder /app/packages/printer_service/dist ./packages/printer_service/dist
COPY --from=builder /app/packages/web-api/dist ./packages/web-api/dist
COPY --from=builder /app/packages/telegram_bot ./packages/telegram_bot

RUN addgroup -g 1001 -S nodejs
RUN adduser -S eddo -u 1001
RUN chown -R eddo:nodejs /app
USER eddo

CMD ["pnpm", "--filter", "@eddo/telegram-bot", "start"]
