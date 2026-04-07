export type QueueJobStatus = 'queued' | 'processing' | 'dead';

export interface QueueJob<TPayload> {
  id: string;
  type: string;
  payload: TPayload;
  attempts: number;
  maxAttempts: number;
  status: QueueJobStatus;
  createdAt: string;
  updatedAt: string;
  nextRunAt?: string;
  lastError?: string;
}

export interface RuntimeQueue {
  enqueue<TPayload>(type: string, payload: TPayload, options?: { maxAttempts?: number }): QueueJob<TPayload>;
  claimReady(limit?: number): QueueJob<unknown>[];
  complete(jobId: string): void;
  fail(jobId: string, error: string, backoffMs: number[]): QueueJob<unknown> | undefined;
  listDeadLetter(): QueueJob<unknown>[];
  replayDeadLetter(jobId: string): QueueJob<unknown> | undefined;
  getMetrics(): {
    queuedCount: number;
    processingCount: number;
    deadLetterCount: number;
    totalJobs: number;
    retryScheduledCount: number;
  };
}
