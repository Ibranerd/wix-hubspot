import { InMemoryStore } from '../storage/in-memory-store.js';
import { PostgresStore } from '../storage/postgres-store.js';
import type { RuntimeStore } from '../storage/store-contract.js';
import { BullMqQueue } from './bullmq-queue.js';
import { FileJobQueue } from './job-queue.js';
import type { RuntimeQueue } from './queue-contract.js';

export function createRuntimeStore(config: {
  dataDir: string;
  backend: 'file' | 'postgres';
  postgresUrl?: string;
}): RuntimeStore {
  if (config.backend === 'postgres') {
    return new PostgresStore(config.postgresUrl || '');
  }

  return new InMemoryStore(config.dataDir);
}

export function createRuntimeQueue(config: {
  dataDir: string;
  backend: 'file' | 'bullmq';
  redisUrl?: string;
}): RuntimeQueue {
  if (config.backend === 'bullmq') {
    return new BullMqQueue(config.redisUrl || '');
  }

  return new FileJobQueue(config.dataDir);
}
