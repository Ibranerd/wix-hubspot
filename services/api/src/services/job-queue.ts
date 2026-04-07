import { randomUUID } from 'node:crypto';

export interface QueueJob<TPayload> {
  id: string;
  type: string;
  payload: TPayload;
  attempts: number;
  maxAttempts: number;
  nextRunAt?: string;
  lastError?: string;
}

interface EnqueueOptions<TPayload> {
  maxAttempts?: number;
  backoffMs?: number[];
  onRetry?: (job: QueueJob<TPayload>) => void;
  onDeadLetter?: (job: QueueJob<TPayload>) => void;
}

export class InMemoryJobQueue {
  enqueue<TPayload>(
    type: string,
    payload: TPayload,
    handler: (job: QueueJob<TPayload>) => Promise<void>,
    options?: EnqueueOptions<TPayload>
  ): QueueJob<TPayload> {
    const backoffMs = options?.backoffMs || [2000, 10000, 30000, 120000, 600000];
    const job: QueueJob<TPayload> = {
      id: randomUUID(),
      type,
      payload,
      attempts: 0,
      maxAttempts: options?.maxAttempts || 8
    };

    const run = async () => {
      try {
        job.attempts += 1;
        await handler(job);
      } catch (error) {
        job.lastError = error instanceof Error ? error.message : 'unknown_error';
        if (job.attempts >= job.maxAttempts) {
          options?.onDeadLetter?.(job);
          return;
        }

        const delay = backoffMs[Math.min(job.attempts - 1, backoffMs.length - 1)];
        job.nextRunAt = new Date(Date.now() + delay).toISOString();
        options?.onRetry?.(job);
        setTimeout(run, delay);
      }
    };

    setTimeout(run, 0);

    return job;
  }
}
