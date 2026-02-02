# Eddo Self-Host Bundle

Runs Eddo with Docker Compose using public images.

## Requirements

- Docker Desktop or Docker Engine
- Docker Compose

## Quickstart

```bash
curl -fsSL https://get.eddoapp.com/selfhost.tar.gz | tar xz
cd eddo-selfhost
cp .env.example .env
# edit .env values

docker compose up -d
open http://localhost:3000
```

## Repo setup (automated)

If you are running from the repo, use the deploy wizard:

```bash
pnpm deploy:local
```

## Configuration

Update `.env` before starting:

- `JWT_SECRET` must be at least 32 characters.
- `TELEGRAM_BOT_TOKEN` and `ANTHROPIC_API_KEY` are required for the Telegram bot.
- `COUCHDB_URL` includes credentials. Update it if you change CouchDB admin values.
- `EDDO_VERSION` should match a release tag, like `v0.7.0`.

## Services

- Web app + API: http://localhost:3000
- MCP server: http://localhost:3001/mcp
- CouchDB: http://localhost:5984
- Elasticsearch: http://localhost:9222

## Stop

```bash
docker compose down
```

## Data

CouchDB and Elasticsearch data are stored in Docker volumes:

- `eddo_couchdb_data`
- `eddo_elasticsearch_data`
