# Eddo telemetry to the Synology VM

## Deployment contract

The VM runs Elastic Agent 9.5.4 in collector mode alongside Elasticsearch/Kibana 9.5.4.
Use OTLP/HTTP with TLS and Bearer authentication, not an Elasticsearch API key.
The documented LAN endpoint is `https://192.168.1.238:4318`.
The deployment docs still mark LAN activation and remote acceptance pending.
Do not redirect production services until the operator confirms access.

Sources: `~/dev/synology-d925/docs/otlp-service-onboarding.md` and `docs/elastic-agent-vm-operations.md`.

## Access and process environment

Obtain the approved sender policy, public certificate, and receiver token through trusted channels.
Verify the certificate fingerprint. Store secrets outside Git with mode `0600`.
Never distribute the server private key or use `NODE_TLS_REJECT_UNAUTHORIZED=0`.
Supply the following environment before starting Node, not after SDK initialization:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://192.168.1.238:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer%20<receiver-token>
NODE_EXTRA_CA_CERTS=/secure/path/synology-collector.crt
OTEL_SERVICE_NAME=eddo-web-api
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=home,service.version=<release>
```

Load the token from protected secret storage. Percent-encode header values as required by the SDK.
Generic endpoints omit `/v1/traces`; signal-specific endpoints include the complete path.
Use the installed `dev:otel` or `start:otel` service scripts from the repository root.
Ordinary `dev` scripts do not preload the Node SDK. Existing OTel scripts hardcode environment attributes;
review or update those assignments before claiming the exported environment is `home`.
Use distinct names for API, MCP, and Telegram services.
The existing local collector's CouchDB scrape does not automatically move to the VM.

## Browser forwarding

The browser sends traces to its same-origin `/api/telemetry/v1/traces` route.
It supplies the current application JWT at export time; the API authenticates the request.
Pre-login exports are unauthorized and are not ingested.
The API replaces browser authorization with configured server-side OTLP headers.
`OTEL_API_KEY` remains a legacy fallback only when OTLP headers omit Authorization.
Do not place the VM receiver token in `OTEL_API_KEY` or any `VITE_*` variable.

The proxy preserves JSON/protobuf bytes, rejects redirects, caps requests at 1 MiB,
and bounds collector requests to ten seconds. Export failures do not expose raw headers or exception values.
HTTP acceptance and partial-success responses do not establish Elasticsearch ingestion.
The default unconfigured localhost endpoint retains its historical discard behavior outside benchmark mode.

## Opt-in benchmark traces

```bash
VITE_OTEL_ENABLED=true pnpm build:web-client
# Supply the protected runtime environment above before executing:
pnpm benchmark:day-paging --headed --steps 6 --background rss-50 --telemetry
pnpm benchmark:background-writes --headed --steps 6 --telemetry
```

Without `--telemetry`, benchmark Node SDKs remain disabled and browser exports are discarded.
Opted-in runs preload the installed ESM SDK before application imports.
API and writer services use `eddo-benchmark-api` and `eddo-benchmark-writer`.
Browser paging spans use `benchmark.paging`, with bounded date, view, count, duration, and change attributes.
Readiness failures mark spans as errors. No todo IDs, bodies, or credentials enter these custom spans.
The existing browser instrumentation provides HTTP spans; automatic Node instrumentation covers supported requests.
The writer's console output is not automatically an OTLP log.

All benchmark components share a run ID and scenario resource attributes.
Independent writer requests are correlated by run ID, not claimed as children of each paging span.
Routing uses dataset `eddo.benchmark`, namespace `benchmark`, and environment `benchmark`.
Reports record the run ID and enabled state. Resume refuses to mix enabled and disabled cases.
Compare timing statistics only with matching telemetry settings; SDK/export overhead changes the workload.
Browser exports flush before closure. Flush failures remain separate diagnostics, not successful-ingestion claims.

## Verification

Local checks cover encoded Bearer headers, JSON/protobuf forwarding, request limits,
legacy fallback, browser JWT refresh, error redaction, and opt-in configuration.
A localhost smoke check with installed Elastic Node SDK 1.8.0 verified a protobuf trace,
percent-decoded Bearer header, and graceful exit flushing. This did not contact the Synology VM.

After LAN activation, verify Node export and browser forwarding separately.
Confirm the benchmark run ID in indexed traces and verify service names, namespace, and error spans.
Then verify logs, metrics, and derived APM metrics independently; trace success does not prove those signals.
Review application privacy, sampling, retention, and shared-token authorization before enabling general production telemetry.
Keep local benchmark reports authoritative when telemetry delivery fails.
No remote acceptance or production rollout is claimed by the local checks.
