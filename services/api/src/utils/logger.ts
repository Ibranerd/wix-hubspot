const REDACT_KEYS = ['email', 'phone', 'firstName', 'lastName', 'token', 'accessToken', 'refreshToken'];

function redactValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(obj)) {
    if (REDACT_KEYS.includes(key)) {
      next[key] = '[REDACTED]';
      continue;
    }

    next[key] = redactValue(entry);
  }

  return next;
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: 'info', message, context: redactValue(context), ts: new Date().toISOString() }));
}

export function logError(message: string, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({ level: 'error', message, context: redactValue(context), ts: new Date().toISOString() })
  );
}
