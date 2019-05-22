import { escapeRegExp } from 'lodash';
import { db } from '../../utils';

export async function getTweetsFromDb(
  options,
  projection?
): Promise<DbTweet[]> {
  const { limit = 20 } = options;

  const filter = getFilterCondition(options);
  if (!filter) return [];
  return await db()
    .collection('tweets')
    .find(filter, projection)
    .sort({ 'tweet.id_str': -1 })
    .limit(limit)
    .toArray();
}

export async function getNewTweetsNumber(options) {
  const filter = getFilterCondition(options);
  if (!filter) return 0;
  return await db()
    .collection('tweets')
    .find(filter)
    .count();
}

function getFilterCondition(options) {
  const {
    url_keywords,
    url_keywords_ne,
    hashtags,
    hashtags_ne,
    usernames,
    lists,
    exclude_replies,
    exclude_retweets,
    maxId,
    sinceId,
  } = options;

  if (!(usernames.length || lists.length)) return;

  const regexify = arr => arr.map(i => new RegExp(escapeRegExp(i), 'i'));
  const lowerify = arr => arr.map(i => i.toLowerCase());
  const toQuery = op => (arr, equal?: boolean) =>
    arr &&
    arr.length && {
      [op]: (equal ? lowerify : regexify)(arr),
    };

  const $and = [];

  $and.push({ 'search.source': { $in: usernames.concat(lists) } });

  if (maxId) $and.push({ 'tweet.id_str': { $lt: maxId } });
  if (sinceId) $and.push({ 'tweet.id_str': { $gt: sinceId } });

  const url_keywords_in = toQuery('$in')(url_keywords);
  const url_keywords_nin = toQuery('$nin')(url_keywords_ne);
  const hashtags_in = toQuery('$in')(hashtags, true);
  const hashtags_nin = toQuery('$nin')(hashtags_ne, true);

  if (url_keywords_in && hashtags_in) {
    $and.push({
      $or: [
        { 'search.urls': url_keywords_in },
        { 'search.hashtags': hashtags_in },
      ],
    });
  } else if (url_keywords_in) {
    $and.push({ 'search.urls': url_keywords_in });
  } else if (hashtags_in) {
    $and.push({ 'search.hashtags': hashtags_in });
  }

  if (url_keywords_nin) $and.push({ 'search.urls': url_keywords_nin });
  if (hashtags_nin) $and.push({ 'search.hashtags': hashtags_nin });
  if (exclude_replies) $and.push({ 'tweet.in_reply_to_screen_name': null });
  if (exclude_retweets) $and.push({ 'tweet.retweeted_status': null });

  const filter = $and.length > 1 ? { $and } : $and[0];
  // console.log('filter', JSON.stringify(filter, null, 2));
  return filter;
}

export const parseRequestQuery = query => {
  let {
    url_keywords,
    hashtags,
    usernames,
    lists,
    maxId,
    sinceId,
    exclude_replies,
    exclude_retweets,
  } = query;

  let url_keywords_ne;
  if (url_keywords) {
    url_keywords_ne = url_keywords
      .split(',')
      .filter(i => i.charAt(0) === '-')
      .map(i => i.slice(1));
    url_keywords = url_keywords.split(',').filter(i => i.charAt(0) !== '-');
  }

  let hashtags_ne;
  if (hashtags) {
    hashtags_ne = hashtags
      .split(',')
      .filter(i => i.charAt(0) === '-')
      .map(i => i.slice(1));
    hashtags = hashtags.split(',').filter(i => i.charAt(0) !== '-');
  }

  usernames = usernames ? usernames.split(',') : [];
  lists = lists ? lists.split(',') : [];

  return {
    url_keywords,
    url_keywords_ne,
    hashtags,
    hashtags_ne,
    usernames,
    lists,
    exclude_replies: !!(exclude_replies && exclude_replies === 'true'),
    exclude_retweets: !!(exclude_retweets && exclude_retweets === 'true'),
    maxId: maxId,
    sinceId: sinceId,
  };
};
