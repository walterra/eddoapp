import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  active: vi.fn(() => ({ name: 'active' })),
  contextWith: vi.fn((_context, callback: () => unknown) => callback()),
  end: vi.fn(),
  setAttributes: vi.fn(),
  setSpan: vi.fn(() => ({ name: 'paging' })),
  setStatus: vi.fn(),
  startSpan: vi.fn(),
}));

vi.mock('@opentelemetry/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@opentelemetry/api')>();
  return {
    ...original,
    context: { active: mocks.active, with: mocks.contextWith },
    trace: { setSpan: mocks.setSpan },
  };
});
vi.mock('../telemetry/config', () => ({ createTelemetryConfig: () => ({ enabled: true }) }));
vi.mock('../telemetry/tracer', () => ({
  flushTelemetry: vi.fn(),
  getTracer: () => ({ startSpan: mocks.startSpan }),
}));

import { exposeBenchmarkTelemetry } from './benchmark_telemetry';

describe('exposeBenchmarkTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem('eddoBenchmarkTelemetry', 'true');
    mocks.startSpan.mockReturnValue({
      end: mocks.end,
      setAttributes: mocks.setAttributes,
      setStatus: mocks.setStatus,
    });
    window.fetch = vi.fn().mockResolvedValue(new Response());
  });

  afterEach(() => sessionStorage.clear());

  it('parents fetch instrumentation to the active paging span', async () => {
    exposeBenchmarkTelemetry();
    window.__eddoBenchmarkStartSpan?.({ view: 'table', date: '2026-10-05', todoCount: 20 });

    await window.fetch('/api/db');

    expect(mocks.setSpan).toHaveBeenCalled();
    expect(mocks.contextWith).toHaveBeenCalledWith({ name: 'paging' }, expect.any(Function));
    window.__eddoBenchmarkEndSpan?.({ durationMs: 10000, localChanges: 200, failed: false });
  });
});
