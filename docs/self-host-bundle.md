# Self-Host Bundle Specification

## Goal

Provide a self-hosted bundle for tech-savvy end users. Runs the full Eddo stack with Docker Compose and public images.

## Scope

Required services:

- web-api (serves web-client + API)
- mcp-server
- telegram-bot
- CouchDB
- Elasticsearch

## Bundle Layout

```
self-host/
  docker-compose.yml
  .env.example
  README.md
```

## Docker Compose Requirements

### Services

- eddo-web-api
  - Image: walterra/eddo-web-api:<tag>
  - Ports: 3000:3000
  - Depends on: couchdb, elasticsearch
  - Health check: http://localhost:3000/health

- eddo-mcp-server
  - Image: walterra/eddo-mcp-server:<tag>
  - Ports: 3001:3001
  - Depends on: couchdb

- eddo-telegram-bot
  - Image: walterra/eddo-telegram-bot:<tag>
  - No inbound ports
  - Depends on: mcp-server

- couchdb
  - Image: couchdb:3
  - Ports: 5984:5984
  - Volume: couchdb_data

- elasticsearch
  - Image: elasticsearch:9.2.4
  - Ports: 9222:9200, 9322:9300
  - Volume: elasticsearch_data

### Networking

- Single bridge network for service discovery.

### Volumes

- couchdb_data
- elasticsearch_data

## Environment Template (.env.example)

Minimum required variables:

- COUCHDB_ADMIN_USERNAME
- COUCHDB_ADMIN_PASSWORD
- COUCHDB_DB_NAME
- COUCHDB_URL (internal service URL for app services)
- ELASTICSEARCH_URL
- JWT_SECRET
- MCP_SERVER_URL
- TELEGRAM_BOT_TOKEN
- ANTHROPIC_API_KEY
- LLM_MODEL
- NODE_ENV=production

## Quickstart (End User)

```
curl -fsSL https://get.eddoapp.com/selfhost.tar.gz | tar xz
cd eddo-selfhost
cp .env.example .env
# edit .env values

docker compose up -d
open http://localhost:3000
```

## Image Pipeline

- Build and publish images on release tags.
- Registry: Docker Hub (public).
- Tags: use app version (e.g., v0.7.0) and latest.
- Images:
  - eddo-web-api
  - eddo-mcp-server
  - eddo-telegram-bot

## Non-Goals

- No local source builds in the self-host bundle.
- No partial stack mode (all three app services required).
- No SaaS onboarding flow.
