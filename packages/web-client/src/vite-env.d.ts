/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NODE_ENV: string;
  /** OpenTelemetry service name */
  readonly VITE_OTEL_SERVICE_NAME?: string;
  /** OpenTelemetry service version */
  readonly VITE_OTEL_SERVICE_VERSION?: string;
  /** OpenTelemetry deployment environment */
  readonly VITE_OTEL_ENVIRONMENT?: string;
  /** OpenTelemetry traces endpoint URL */
  readonly VITE_OTEL_TRACES_ENDPOINT?: string;
  /** Enable/disable OpenTelemetry (default: true) */
  readonly VITE_OTEL_ENABLED?: string;
  /** OpenTelemetry log level */
  readonly VITE_OTEL_LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
