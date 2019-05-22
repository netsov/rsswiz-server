import { subscribeToQueue, sendMessageTTL } from './utils';
import { to, ch, db, sanitizeUserFeeds, getTimestampString } from '../utils';
import { mainExchange, syncQueue, syncQueueTTL, syncRK, clientRK } from './';
import {
  fetchAndStoreTweets,
  fetchLists,
  fetchListTweets,
  fetchTweets,
} from '../twitter';
import { config } from '../config';

import { generateAndStoreRSS } from '../rss';

export async function subscribeToSyncQueue() {
  await to(
    subscribeToQueue({
      queueName: syncQueue(),
      exchange: mainExchange(),
      routingKey: syncRK(),
      queueOptions: { autoDelete: true, durable: false },
      handler: syncHandler,
      errorHandler: async () => await to(invokeSyncTaskTTL()),
    })
  );
  await invokeSyncTask();
}

export const invokeSyncTask = async () =>
  ch().sendToQueue(syncQueue(), Buffer.from('{}'));

export const invokeSyncTaskTTL = async () => {
  await to(
    sendMessageTTL({
      queueNameTTL: syncQueueTTL(),
      deadLetterRoutingKey: syncRK(),
      ttl: config.worker.syncTTL,
      msg: {},
    })
  );
};

const setAccountMeta = accountId => total =>
  db()
    .collection('users')
    .findOneAndUpdate(
      { accounts: { $elemMatch: { 'profile.id': accountId } } },
      {
        $set: {
          'accounts.$.synced': getTimestampString(),
          'accounts.$.total': total,
        },
      }
    );

const setListMeta = listId => async total => {
  await db()
    .collection('users')
    .findOneAndUpdate(
      { lists: { $elemMatch: { id_str: listId } } },
      {
        $set: {
          'lists.$.synced': getTimestampString(),
          'lists.$.total': total,
        },
      }
    );
};

const isTimeToSync = timestamp =>
  !timestamp ||
  parseInt(getTimestampString()) - parseInt(timestamp) > config.worker.syncTTL;

const syncLists = async (user: User, account: Account): Promise<User> => {
  const lists = await fetchLists(account);

  await db()
    .collection('users')
    .findOneAndUpdate(
      { _id: user._id },
      {
        $pull: {
          lists: { accountId: account.profile.id },
        },
      },
      { returnOriginal: false }
    );

  user = (await db()
    .collection('users')
    .findOneAndUpdate(
      {
        _id: user._id,
        accounts: { $elemMatch: { 'profile.id': account.profile.id } },
      },
      {
        $pushAll: {
          lists: lists,
        },
        $set: {
          'accounts.$.listsSyncedTS': getTimestampString(),
        },
      },
      { returnOriginal: false }
    )).value;

  return user;
};

export const syncUserTweets = async (user: User, feedId?: string) => {
  let synced = false;
  const feeds = user.feeds.filter(feed => !feedId || feed._id === feedId);
  const isOn = (field, target) =>
    feeds.some(feed => feed[field].includes(target));

  for (const account of user.accounts) {
    if (account.expired) continue;

    if (
      isTimeToSync(account.synced) &&
      isOn('usernames', account.profile.username)
    ) {
      try {
        await fetchAndStoreTweets(
          account.profile.username,
          fetchTweets,
          setAccountMeta(account.profile.id)
        )(account);
        synced = true;
      } catch (e) {
        console.error(`error syncing account ${account.profile.username}`);
        return;
      }
    }

    if (isTimeToSync(account.listsSyncedTS)) {
      synced = true;
      try {
        user = await syncLists(user, account);
      } catch (e) {
        console.error(
          `error syncing account\'s ${account.profile.username} lists`
        );
        return;
      }
    }

    for (const list of user.lists) {
      if (list.accountId !== account.profile.id) continue;
      if (isOn('lists', list.id_str) && isTimeToSync(list.synced)) {
        try {
          await fetchAndStoreTweets(
            list.id_str,
            fetchListTweets(list.id_str),
            setListMeta(list.id_str)
          )(account);
          synced = true;
        } catch (e) {
          console.error(
            `error syncing account\'s ${account.profile.username} list ${
              list.full_name
            }`
          );
          return;
        }
      }
    }
  }

  const sanitized = await sanitizeUserFeeds(user);

  await Promise.all(
    feeds.map(feed => generateAndStoreRSS(feed, user.accounts, user.lists))
  );
  if (synced || sanitized) await to(notifyClients(user._id));
};

const notifyClients = async userId => {
  const msg = {};
  const sent = ch().publish(
    mainExchange(),
    clientRK(userId),
    Buffer.from(JSON.stringify(msg))
  );
  console.log('[notify] sent to client %s', userId, sent);
};

const syncHandler = async () => {
  const cursor = db()
    .collection('users')
    .find({});
  while (await cursor.hasNext()) {
    const user: User = await cursor.next();
    try {
      await syncUserTweets(user);
    } catch (e) {
      console.error(`!!! error syncing ${user._id}`);
    }
  }
  await invokeSyncTaskTTL();
};
