import { SpanStatusCode, type Span } from '@opentelemetry/api';
import { createTelemetryConfig } from '../telemetry/config';
import { flushTelemetry, getTracer } from '../telemetry/tracer';

interface PagingSpanOptions {
  view: string;
  date: string;
  todoCount: number;
}
interface PagingSpanResult {
  durationMs: number;
  localChanges: number;
  failed: boolean;
}
declare global {
  interface Window {
    __eddoBenchmarkStartSpan?: (options: PagingSpanOptions) => void;
    __eddoBenchmarkEndSpan?: (result: PagingSpanResult) => void;
    __eddoBenchmarkFlushTelemetry?: () => Promise<void>;
  }
}

/** Installs bounded synthetic paging spans only for explicitly opted-in benchmark sessions. */
export function exposeBenchmarkTelemetry(): void {
  if (
    sessionStorage.getItem('eddoBenchmarkTelemetry') !== 'true' ||
    !createTelemetryConfig().enabled
  )
    return;
  let current: Span | undefined;
  window.__eddoBenchmarkStartSpan = (options) => {
    current?.end();
    current = getTracer().startSpan('benchmark.paging', {
      attributes: {
        'benchmark.view': options.view,
        'benchmark.date': options.date,
        'benchmark.todo_count': options.todoCount,
      },
    });
  };
  window.__eddoBenchmarkEndSpan = (result) => {
    current?.setAttributes({
      'benchmark.duration_ms': result.durationMs,
      'benchmark.local_changes': result.localChanges,
    });
    current?.setStatus({ code: result.failed ? SpanStatusCode.ERROR : SpanStatusCode.OK });
    current?.end();
    current = undefined;
  };
  window.__eddoBenchmarkFlushTelemetry = flushTelemetry;
}
