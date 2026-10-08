import { context, SpanStatusCode, trace, type Context, type Span } from '@opentelemetry/api';
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
type PagingContextProvider = () => Context | undefined;

/** Runs instrumented fetches inside the active paging span context. */
function installPagingFetchContext(provider: PagingContextProvider): void {
  const instrumentedFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const pagingContext = provider();
    if (!pagingContext) return instrumentedFetch(input, init);
    return context.with(pagingContext, () => instrumentedFetch(input, init));
  };
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
  let pagingContext: Context | undefined;
  installPagingFetchContext(() => pagingContext);
  window.__eddoBenchmarkStartSpan = (options) => {
    current?.end();
    current = getTracer().startSpan('benchmark.paging', {
      attributes: {
        'benchmark.view': options.view,
        'benchmark.date': options.date,
        'benchmark.todo_count': options.todoCount,
      },
    });
    pagingContext = trace.setSpan(context.active(), current);
  };
  window.__eddoBenchmarkEndSpan = (result) => {
    current?.setAttributes({
      'benchmark.duration_ms': result.durationMs,
      'benchmark.local_changes': result.localChanges,
    });
    current?.setStatus({ code: result.failed ? SpanStatusCode.ERROR : SpanStatusCode.OK });
    current?.end();
    current = undefined;
    pagingContext = undefined;
  };
  window.__eddoBenchmarkFlushTelemetry = flushTelemetry;
}
