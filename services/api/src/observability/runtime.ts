export interface ObservabilityConfig {
  serviceName: string;
  sentryDsn?: string;
  environment?: string;
  otelExporterOtlpEndpoint?: string;
}

interface SentryLike {
  init?: (config: Record<string, unknown>) => void;
  captureException?: (error: unknown) => void;
  flush?: (timeout?: number) => Promise<boolean>;
}

let sentryClient: SentryLike | null = null;
let otelEnabled = false;

export async function initObservability(config: ObservabilityConfig): Promise<void> {
  if (config.sentryDsn) {
    try {
      const sentryModule = (await import('@sentry/node')) as SentryLike;
      sentryModule.init?.({
        dsn: config.sentryDsn,
        environment: config.environment || 'development'
      });
      sentryClient = sentryModule;
    } catch {
      // Optional dependency; fall back silently when package is not installed.
    }
  }

  if (config.otelExporterOtlpEndpoint) {
    try {
      await import('@opentelemetry/api');
      otelEnabled = true;
    } catch {
      // Optional dependency; exporter wiring is enabled when package exists.
    }
  }
}

export function captureException(error: unknown): void {
  sentryClient?.captureException?.(error);
}

export function withSpan<T>(name: string, fn: () => T): T {
  // Minimal runtime hook; if OTEL SDK is wired, this is where a tracer span would be started.
  // Name is intentionally kept so traces can be added without changing call sites.
  void name;
  return fn();
}

export async function shutdownObservability(): Promise<void> {
  if (sentryClient?.flush) {
    await sentryClient.flush(2000);
  }

  sentryClient = null;
  otelEnabled = false;
}

export function observabilityState(): { sentryEnabled: boolean; otelEnabled: boolean } {
  return {
    sentryEnabled: Boolean(sentryClient),
    otelEnabled
  };
}
