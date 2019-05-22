import { config } from './config';
import { connectToRabbitMQ, connectToMongoDB, sentryConfig } from './utils';
import { subscribeToWorkerQueue } from './amqp/worker';
import { subscribeToSyncQueue } from './amqp/sync';
import { subscribeToSchedulerQueue } from './amqp/scheduler';
import { subscribeToRetentionQueue } from './amqp/retention';

sentryConfig(config.sentry.workerDSN);

(async function worker() {
  console.log('[worker] starting...');

  await connectToRabbitMQ();
  await connectToMongoDB();

  await subscribeToWorkerQueue();
  await subscribeToSchedulerQueue();
  await subscribeToSyncQueue();
  await subscribeToRetentionQueue();
})();
