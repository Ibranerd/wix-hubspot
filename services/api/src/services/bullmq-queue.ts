import type { RuntimeQueue, QueueJob } from './queue-contract.js';

// Thin scaffold for production Redis/BullMQ backend.
// Runtime wiring currently defaults to file queue unless explicitly requested.
export class BullMqQueue implements RuntimeQueue {
  constructor(private readonly redisUrl: string) {
    if (!redisUrl) {
      throw new Error('REDIS_URL is required for BullMqQueue');
    }
  }

  private unsupported(): never {
    throw new Error('BullMqQueue scaffold exists but is not wired in this branch');
  }

  enqueue<TPayload>(): QueueJob<TPayload> {
    return this.unsupported();
  }
  claimReady(): QueueJob<unknown>[] {
    return this.unsupported();
  }
  complete(): void {
    return this.unsupported();
  }
  fail(): QueueJob<unknown> | undefined {
    return this.unsupported();
  }
  listDeadLetter(): QueueJob<unknown>[] {
    return this.unsupported();
  }
  replayDeadLetter(): QueueJob<unknown> | undefined {
    return this.unsupported();
  }
  getMetrics() {
    return this.unsupported();
  }
}
