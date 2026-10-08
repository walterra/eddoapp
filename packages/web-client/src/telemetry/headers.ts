/** Reads the current application JWT at export time; collector credentials never enter the browser. */
export async function browserTelemetryHeaders(): Promise<Record<string, string>> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('authToken') ?? 'null');
    if (
      typeof value === 'object' &&
      value !== null &&
      'token' in value &&
      typeof value.token === 'string'
    ) {
      return { Authorization: `Bearer ${value.token}` };
    }
  } catch {
    // Unauthenticated and malformed sessions cannot forward telemetry.
  }
  return {};
}
