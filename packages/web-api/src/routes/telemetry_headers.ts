interface TelemetryAuthentication {
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  OTEL_API_KEY?: string;
}

/** Parses standard percent-encoded OTLP headers without exposing values in errors. */
export function parseOtlpHeaders(value: string | undefined): Headers {
  const headers = new Headers();
  for (const entry of value?.split(',').filter((part) => part.trim()) ?? []) {
    const separator = entry.indexOf('=');
    if (separator < 1) throw new Error('Invalid OTLP header configuration');
    try {
      const name = decodeURIComponent(entry.slice(0, separator).trim());
      const decoded = decodeURIComponent(entry.slice(separator + 1).trim());
      if (/[\r\n]/.test(decoded) || headers.has(name)) throw new Error('Invalid header');
      headers.set(name, decoded);
    } catch {
      throw new Error('Invalid OTLP header configuration');
    }
  }
  return headers;
}

/** Adds server-side authentication without forwarding browser authorization or cookies. */
export function buildTelemetryHeaders(
  config: TelemetryAuthentication,
  contentType: string,
): Headers {
  const headers = parseOtlpHeaders(config.OTEL_EXPORTER_OTLP_HEADERS);
  headers.set('Content-Type', contentType);
  if (config.OTEL_API_KEY && !headers.has('Authorization')) {
    headers.set('Authorization', `ApiKey ${config.OTEL_API_KEY}`);
  }
  return headers;
}
