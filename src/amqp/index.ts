import { generateId } from '../utils/index';

export const mainExchange = () => 'MainExchange';

export const schedulerQueue = () => `SCHEDULER`;
export const schedulerQueueTTL = () => `SCHEDULER:TTL`;
export const syncQueue = () => `SYNC`;
export const syncQueueTTL = () => `SYNC:TTL`;
export const workerQueue = () => `WORKER:${generateId()}`;
export const clientQueue = userId => `CLIENT:${userId}:${generateId()}`;
export const retentionQueue = () => `RETENTION`;
export const retentionQueueTTL = () => `RETENTION:TTL`;

export const workersRK = () => 'workersRK';
export const schedulerRK = () => 'scheduler';
export const syncRK = () => 'sync';
export const retentionRK = () => 'retention';
export const clientRK = userId => `CLIENT:${userId}`;
