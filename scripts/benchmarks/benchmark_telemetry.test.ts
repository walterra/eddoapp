import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  telemetryEnvironment,
  telemetryImports,
  validateBenchmarkTelemetry,
} from './benchmark_telemetry';

afterEach(() => vi.unstubAllEnvs());

describe('opt-in benchmark telemetry', () => {
  it('does not require access or preload an SDK for baseline runs', () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');
    expect(() => validateBenchmarkTelemetry(false)).not.toThrow();
    expect(telemetryImports(false)).toEqual([]);
    expect(
      telemetryEnvironment(
        { telemetry: false, runId: 'synthetic', background: 'control' },
        'benchmark',
      ).OTEL_SDK_DISABLED,
    ).toBe('true');
  });
  it('requires an explicit secure remote destination and bearer headers', () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');
    expect(() => validateBenchmarkTelemetry(true)).toThrow('explicitly exported');
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://192.168.1.238:4318');
    expect(() => validateBenchmarkTelemetry(true)).toThrow('HTTPS');
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://192.168.1.238:4318');
    vi.stubEnv('OTEL_EXPORTER_OTLP_HEADERS', '');
    expect(() => validateBenchmarkTelemetry(true)).toThrow('Bearer');
    vi.stubEnv('OTEL_EXPORTER_OTLP_HEADERS', 'Authorization=Bearer%20synthetic');
    expect(() => validateBenchmarkTelemetry(true)).not.toThrow();
  });
  it('resolves the ESM preloader and isolates benchmark routing', () => {
    expect(telemetryImports(true)[1]).toMatch(/import\.mjs$/);
    const env = telemetryEnvironment(
      { telemetry: true, runId: 'synthetic', background: 'rss-10' },
      'eddo-benchmark-writer',
    );
    expect(env.OTEL_SDK_DISABLED).toBe('false');
    expect(env.OTEL_SERVICE_NAME).toBe('eddo-benchmark-writer');
    expect(env.OTEL_RESOURCE_ATTRIBUTES).toContain('data_stream.namespace=benchmark');
    expect(env.OTEL_RESOURCE_ATTRIBUTES).toContain('benchmark.run.id=synthetic');
  });
});
