import { db } from './mongo';
import { generateId, getTimestampString } from './index';

export const generateNewFeed = (username?: string): Feed => ({
  _id: generateId(),
  usernames: username ? [username] : [],
  lists: [],
  limit: 100,
  created: getTimestampString(),
  updated: username ? getTimestampString() : undefined,
});

export const sanitizeUserFeeds = async (user: User): Promise<boolean> => {
  let sanitized;
  const activeAccounts = user.accounts.filter(account => !account.expired);
  const usernames = activeAccounts.map(a => a.profile.username);
  const listIds = user.lists
    .filter(({ accountId }) =>
      activeAccounts.find(a => a.profile.id === accountId)
    )
    .map(({ id_str }) => id_str);

  for (const feed of user.feeds) {
    const $pull: any = {};
    const staleUsernames = feed.usernames.filter(u => !usernames.includes(u));
    const staleLists = feed.lists.filter(listId => !listIds.includes(listId));

    if (staleUsernames.length)
      $pull['feeds.$.usernames'] = { $in: staleUsernames };
    if (staleLists.length) $pull['feeds.$.lists'] = { $in: staleLists };

    if (!Object.keys($pull).length) continue;
    console.log('[sanitize] %s', feed._id, staleUsernames, staleLists);

    await db()
      .collection('users')
      .findOneAndUpdate(
        { _id: user._id, feeds: { $elemMatch: { _id: feed._id } } },
        { $pull },
        { returnOriginal: false }
      );

    sanitized = true;
  }

  return sanitized;
};
