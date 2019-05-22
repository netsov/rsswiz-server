import { subscribeToQueue, sendMessageTTL } from './utils';
import { to, sendFeedEmail, ch, db, getUnixTimestamp } from '../utils';
import {config} from '../config'

import {
  mainExchange,
  schedulerQueue,
  schedulerQueueTTL,
  schedulerRK,
} from './';

export const invokeSchedulerTaskTTL = async () => {
  await to(
    sendMessageTTL({
      queueNameTTL: schedulerQueueTTL(),
      deadLetterRoutingKey: schedulerRK(),
      ttl: config.worker.schedulerTTL,
      msg: {},
    })
  );
};

export const invokeSchedulerTask = () =>
  ch().sendToQueue(schedulerQueue(), Buffer.from('{}'));

export async function subscribeToSchedulerQueue() {
  await to(
    subscribeToQueue({
      queueName: schedulerQueue(),
      exchange: mainExchange(),
      routingKey: schedulerRK(),
      queueOptions: { autoDelete: true, durable: false },
      handler: schedulerHandler,
      errorHandler: async () => await to(invokeSchedulerTaskTTL()),
    })
  );
  await invokeSchedulerTask();
}

export const schedulerHandler = async () => {
  const users: User[] = await db().collection('users').find({}).toArray();
  const currentUTCHours = new Date().getUTCHours();
  const currentUTCDay = new Date().getUTCDay();

  const promises = users
    .filter(user => user.feeds.length)
    .filter(({ email }) => email && email.confirmed && email.value)
    .map(user => {
      const times = user.schedule && user.schedule.times;
      const matchedTime =
        times &&
        times.find(
          t =>
            t.utcHours === currentUTCHours && t.sent !== currentUTCDay && t.on
        );

      return { user, matchedTime };
    })
    .filter(({ user, matchedTime }) => !!matchedTime)
    .map(async ({ user, matchedTime }) => {
      const feeds = user.feeds.filter(({ synced }) => {
        return synced && parseInt(synced, 10) > getUnixTimestamp() - 3600000;
      });

      if (!feeds.length) return;

      await to(sendFeedEmail(user, feeds));

      await db().collection('users').findOneAndUpdate(
        {
          _id: user._id,
          'schedule.times': { $elemMatch: { i: matchedTime.i } },
        },
        {
          $set: { 'schedule.times.$.sent': currentUTCDay },
        }
      );
    });

  if (promises.length)
    console.log('[scheduler] %s emails to send', promises.length);
  await Promise.all(promises);
  await invokeSchedulerTaskTTL();
};
