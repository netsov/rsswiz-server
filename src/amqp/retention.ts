import { subscribeToQueue, sendMessageTTL } from './utils';
import { to, retentionTS, ch, db } from '../utils';
import { config } from '../config';

import {
  mainExchange,
  retentionQueue,
  retentionQueueTTL,
  retentionRK,
} from './';

export async function subscribeToRetentionQueue() {
  await to(
    subscribeToQueue({
      queueName: retentionQueue(),
      exchange: mainExchange(),
      routingKey: retentionRK(),
      queueOptions: { autoDelete: true, durable: false },
      handler: retentionHandler,
      errorHandler: async () => await to(invokeRetentionTaskTTL()),
    })
  );
  await invokeRetentionTask();
}

export const invokeRetentionTask = () =>
  ch().sendToQueue(retentionQueue(), Buffer.from('{}'));

export const invokeRetentionTaskTTL = async () => {
  await to(
    sendMessageTTL({
      queueNameTTL: retentionQueueTTL(),
      deadLetterRoutingKey: retentionRK(),
      ttl: config.worker.retentionTTL,
      msg: {},
    })
  );
};

export const retentionHandler = async () => {
  const result = await db()
    .collection('tweets')
    .deleteMany({
      time: { $lt: retentionTS() },
    });

  console.log('[retention]', result.result);
  await invokeRetentionTaskTTL();
};
