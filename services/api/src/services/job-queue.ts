import { randomUUID } from 'node:crypto';

export interface QueueJob<TPayload> {
  id: string;
  type: string;
  payload: TPayload;
  attempts: number;
  maxAttempts: number;
}

export class InMemoryJobQueue {
  enqueue<TPayload>(
    type: string,
    payload: TPayload,
    handler: (job: QueueJob<TPayload>) => Promise<void>
  ): QueueJob<TPayload> {
    const job: QueueJob<TPayload> = {
      id: randomUUID(),
      type,
      payload,
      attempts: 0,
      maxAttempts: 8
    };

    setTimeout(async () => {
      try {
        job.attempts += 1;
        await handler(job);
      } catch {
        // Retry strategy is added in Phase 5; this queue keeps the async boundary for now.
      }
    }, 0);

    return job;
  }
}
