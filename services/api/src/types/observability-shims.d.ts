declare module '@sentry/node' {
  const sentry: {
    init?: (config: Record<string, unknown>) => void;
    captureException?: (error: unknown) => void;
    flush?: (timeout?: number) => Promise<boolean>;
  };
  export = sentry;
}

declare module '@opentelemetry/api' {
  export {};
}
