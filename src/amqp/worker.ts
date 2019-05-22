import { subscribeToQueue } from './utils';
import { to, db } from '../utils';

import { syncUserTweets } from './sync';
import { mainExchange, workerQueue, workersRK } from './';

export async function subscribeToWorkerQueue() {
  // const workerHandler = (db: Db, ch: Channel) => async ({ userId }) => {
  //   await to(subscribeToUserQueue(userId)(db: Db, ch: Channel));
  // };
  await to(
    subscribeToQueue({
      queueName: workerQueue(),
      exchange: mainExchange(),
      routingKey: workersRK(),
      queueOptions: { autoDelete: true, durable: false },
      handler: handleUserMessage,
    })
  );
}

export const handleUserMessage = async ({ userId, feedId }) => {
  console.log(`[worker] user message received  - userId: ${userId}, feedId: ${feedId}`);
  const user = await db().collection('users').findOne({ _id: userId });
  await syncUserTweets(user, feedId);
};
