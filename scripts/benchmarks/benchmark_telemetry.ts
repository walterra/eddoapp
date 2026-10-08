import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

interface TelemetryHeadersModule {
  parseOtlpHeaders: (value: string | undefined) => Headers;
}

const requireTelemetryModule = createRequire(import.meta.url);
const { parseOtlpHeaders } = requireTelemetryModule(
  '../../packages/web-api/src/routes/telemetry_headers.ts',
) as TelemetryHeadersModule;

interface BenchmarkTelemetry {
  telemetry: boolean;
  runId: string;
  background: string;
}

/** Checks transport and generic endpoint shape without exposing configuration values. */
function allowedEndpoint(url: URL, loopback: boolean): boolean {
  const credentials = Boolean(url.username || url.password);
  const suffix =
    Boolean(url.search || url.hash) || /\/v1\/(traces|metrics|logs)\/?$/.test(url.pathname);
  const transport =
    loopback || (url.protocol === 'https:' && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0');
  return ['http:', 'https:'].includes(url.protocol) && !credentials && !suffix && transport;
}

/** Rejects implicit destinations and invalid headers before starting benchmark resources. */
export function validateBenchmarkTelemetry(enabled: boolean): void {
  if (!enabled) return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) throw new Error('--telemetry requires an explicitly exported OTLP endpoint');
  const url = new URL(endpoint);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!allowedEndpoint(url, loopback))
    throw new Error('Remote benchmark telemetry requires HTTPS without URL credentials');
  const headers = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  if (!loopback && !headers.get('Authorization')?.startsWith('Bearer '))
    throw new Error('Remote benchmark telemetry requires server-side Bearer authentication');
}

/** Resolves the installed service SDK without depending on root package hoisting. */
export function telemetryImports(enabled: boolean): string[] {
  if (!enabled) return [];
  const require = createRequire(resolve('packages/web-api/package.json'));
  return [
    '--import',
    resolve(dirname(require.resolve('@elastic/opentelemetry-node')), 'import.mjs'),
  ];
}

/** Prevents inherited signal-specific settings from routing benchmark data elsewhere. */
function signalEnvironment(enabled: boolean): NodeJS.ProcessEnv {
  if (!enabled) return {};
  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '').replace(/\/$/, '');
  return Object.fromEntries(
    ['TRACES', 'METRICS', 'LOGS'].flatMap((signal) => [
      [`OTEL_EXPORTER_OTLP_${signal}_ENDPOINT`, `${endpoint}/v1/${signal.toLowerCase()}`],
      [`OTEL_EXPORTER_OTLP_${signal}_HEADERS`, process.env.OTEL_EXPORTER_OTLP_HEADERS ?? ''],
      [`OTEL_EXPORTER_OTLP_${signal}_PROTOCOL`, 'http/protobuf'],
    ]),
  );
}

/** Keeps baseline SDKs disabled and separates synthetic benchmark telemetry routing. */
export function telemetryEnvironment(
  options: BenchmarkTelemetry,
  serviceName: string,
): NodeJS.ProcessEnv {
  return {
    ...signalEnvironment(options.telemetry),
    OTEL_TRACES_EXPORTER: options.telemetry ? 'otlp' : 'none',
    OTEL_METRICS_EXPORTER: options.telemetry ? 'otlp' : 'none',
    OTEL_LOGS_EXPORTER: options.telemetry ? 'otlp' : 'none',
    OTEL_SDK_DISABLED: options.telemetry ? 'false' : 'true',
    OTEL_SERVICE_NAME: serviceName,
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
    OTEL_EXPORTER_OTLP_TIMEOUT: process.env.OTEL_EXPORTER_OTLP_TIMEOUT ?? '2000',
    OTEL_RESOURCE_ATTRIBUTES: `deployment.environment=benchmark,data_stream.dataset=eddo.benchmark,data_stream.namespace=benchmark,benchmark.run.id=${options.runId},benchmark.scenario=${options.background}`,
    EDDO_BENCHMARK_TELEMETRY: options.telemetry ? 'true' : 'false',
  };
}
