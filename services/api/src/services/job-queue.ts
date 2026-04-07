import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

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

interface QueueState {
  jobs: QueueJob<unknown>[];
}

interface EnqueueOptions {
  maxAttempts?: number;
}

const INITIAL_QUEUE_STATE: QueueState = {
  jobs: []
};

export class FileJobQueue {
  private readonly queuePath: string;

  constructor(dataDir = process.env.DATA_DIR || '.data') {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.queuePath = join(dataDir, 'jobs.json');
    if (!existsSync(this.queuePath)) {
      this.writeState(INITIAL_QUEUE_STATE);
    }
  }

  enqueue<TPayload>(type: string, payload: TPayload, options?: EnqueueOptions): QueueJob<TPayload> {
    const now = new Date().toISOString();
    const job: QueueJob<TPayload> = {
      id: randomUUID(),
      type,
      payload,
      attempts: 0,
      maxAttempts: options?.maxAttempts || 8,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      nextRunAt: now
    };

    this.mutate((state) => {
      state.jobs.push(job as QueueJob<unknown>);
    });

    return job;
  }

  claimReady(limit = 20): QueueJob<unknown>[] {
    const now = Date.now();
    const claimed: QueueJob<unknown>[] = [];

    this.mutate((state) => {
      for (const job of state.jobs) {
        if (claimed.length >= limit) {
          break;
        }

        if (job.status !== 'queued') {
          continue;
        }

        const nextRunAtMs = job.nextRunAt ? new Date(job.nextRunAt).getTime() : 0;
        if (nextRunAtMs > now) {
          continue;
        }

        job.status = 'processing';
        job.updatedAt = new Date().toISOString();
        claimed.push({ ...job });
      }
    });

    return claimed;
  }

  complete(jobId: string): void {
    this.mutate((state) => {
      state.jobs = state.jobs.filter((job) => job.id !== jobId);
    });
  }

  fail(jobId: string, error: string, backoffMs: number[]): QueueJob<unknown> | undefined {
    let nextJob: QueueJob<unknown> | undefined;

    this.mutate((state) => {
      const job = state.jobs.find((entry) => entry.id === jobId);
      if (!job) {
        return;
      }

      job.attempts += 1;
      job.lastError = error;
      job.updatedAt = new Date().toISOString();

      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead';
        delete job.nextRunAt;
        nextJob = { ...job };
        return;
      }

      const delay = backoffMs[Math.min(job.attempts - 1, backoffMs.length - 1)] ?? 600000;
      job.status = 'queued';
      job.nextRunAt = new Date(Date.now() + delay).toISOString();
      nextJob = { ...job };
    });

    return nextJob;
  }

  listDeadLetter(): QueueJob<unknown>[] {
    const state = this.readState();
    return state.jobs.filter((job) => job.status === 'dead');
  }

  replayDeadLetter(jobId: string): QueueJob<unknown> | undefined {
    let replayed: QueueJob<unknown> | undefined;

    this.mutate((state) => {
      const job = state.jobs.find((entry) => entry.id === jobId);
      if (!job || job.status !== 'dead') {
        return;
      }

      job.status = 'queued';
      job.attempts = 0;
      job.lastError = undefined;
      job.nextRunAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
      replayed = { ...job };
    });

    return replayed;
  }

  getMetrics(): {
    queuedCount: number;
    processingCount: number;
    deadLetterCount: number;
    totalJobs: number;
    retryScheduledCount: number;
  } {
    const state = this.readState();
    let queuedCount = 0;
    let processingCount = 0;
    let deadLetterCount = 0;
    let retryScheduledCount = 0;

    for (const job of state.jobs) {
      if (job.status === 'queued') {
        queuedCount += 1;
      }

      if (job.status === 'processing') {
        processingCount += 1;
      }

      if (job.status === 'dead') {
        deadLetterCount += 1;
      }

      if (job.status === 'queued' && job.attempts > 0) {
        retryScheduledCount += 1;
      }
    }

    return {
      queuedCount,
      processingCount,
      deadLetterCount,
      totalJobs: state.jobs.length,
      retryScheduledCount
    };
  }

  private mutate(mutator: (state: QueueState) => void): void {
    const state = this.readState();
    mutator(state);
    this.writeState(state);
  }

  private readState(): QueueState {
    try {
      const raw = readFileSync(this.queuePath, 'utf8');
      const parsed = JSON.parse(raw) as QueueState;
      return {
        ...INITIAL_QUEUE_STATE,
        ...parsed
      };
    } catch {
      return { ...INITIAL_QUEUE_STATE };
    }
  }

  private writeState(state: QueueState): void {
    const tempPath = `${this.queuePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
    renameSync(tempPath, this.queuePath);
  }
}
