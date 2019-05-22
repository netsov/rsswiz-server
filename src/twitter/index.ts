import * as crypto from 'crypto';
import axios, { AxiosError, AxiosResponse } from 'axios';

import {
  getParamString,
  to,
  dateStringToUnixTimeStamp,
  db,
  retentionTS,
} from '../utils/index';
import { config } from '../config';
// import { TooManyRequestsError } from '../utils/notifications';

const TWITTER_BASE_URL = 'https://api.twitter.com/1.1/';
const MAX_REQUESTS = 15;
const TWEETS_COUNT = 200;

const apiErrHandler = account => async (err: AxiosError) => {
  if (err.response && err.response.status === 401) {
    console.error('[expired] %s', account.profile.username);
    // expired
    await db()
      .collection('users')
      .findOneAndUpdate(
        { accounts: { $elemMatch: { 'profile.id': account.profile.id } } },
        {
          $set: {
            'accounts.$.expired': true,
          },
          // $pull: {
          //   'feed.usernames': account.profile.username,
          // },
        }
      );
  }
};

const sanitizeTweet = (tweet: Tweet): Tweet => {
  const sanitized = {
    id_str: tweet.id_str,
    created_at: tweet.created_at,
    full_text: tweet.full_text,
    in_reply_to_screen_name: tweet.in_reply_to_screen_name,
    in_reply_to_status_id_str: tweet.in_reply_to_status_id_str,
    user: {
      profile_image_url_https: tweet.user.profile_image_url_https,
      name: tweet.user.name,
      screen_name: tweet.user.screen_name,
    },
    retweeted_status: undefined,
    entities: {
      media: tweet.entities.media,
      urls: tweet.entities.urls,
      hashtags: tweet.entities.hashtags,
      user_mentions: tweet.entities.user_mentions,
    },
  };

  if (tweet.retweeted_status) {
    sanitized.retweeted_status = sanitizeTweet(tweet.retweeted_status);
  }

  return sanitized;
};

type Fetcher = (
  account: Account,
  max_id: string,
  since_id: string
) => Promise<AxiosResponse>;

type OnSuccess = (total: number) => Promise<any>;

export const fetchAndStoreTweets = (
  source: string,
  fetcher: Fetcher,
  onSuccess: OnSuccess
) => async (account: Account) => {
  // const { profile: { username } } = account;
  console.log('[source] %s syncing...', source);

  const col = db().collection('tweets');
  const query = { 'search.source': source };

  let response;
  let inserted = 0;
  let batch: DbTweet[][] = [];
  let max_id;
  let n = MAX_REQUESTS;

  const last: any[] = await db()
    .collection('tweets')
    .find(query, { projection: { _id: true } })
    .sort({ _id: -1 })
    .limit(1)
    .toArray();

  let since_id = last && last.length && last[0]._id;

  while (n) {
    n--;

    response = await to(fetcher(account, max_id, since_id));
    const tweets = response.data;

    if (!tweets || tweets.length === 0) {
      // console.log('breaking... zero tweets fetched', tweets);
      break;
    }

    const chunk = tweets
      .filter(
        tweet =>
          tweet.id_str !== max_id && (!since_id || tweet.id_str > since_id)
      )
      .map(tweet => {
        let urls = tweet.entities.urls;
        let hashtags = tweet.entities.hashtags;
        if (tweet.retweeted_status) {
          urls = urls.concat(tweet.retweeted_status.entities.urls);
          hashtags = hashtags.concat(tweet.retweeted_status.entities.hashtags);
        }
        return {
          'search.urls': urls.map(i => i.expanded_url),
          'search.hashtags': hashtags.map(i => i.text.toLowerCase()),
          time: dateStringToUnixTimeStamp(tweet.created_at),
          tweet: sanitizeTweet(tweet),
        };
      })
      .filter(tweet => tweet.time > retentionTS());

    // console.log('chunk', tweets.length, chunk.length);

    if (!chunk.length) {
      // console.log('breaking... empty chunk');
      break;
    }

    max_id = tweets[tweets.length - 1].id_str;
    batch.push(chunk);
    inserted += chunk.length;

    if (chunk.length < TWEETS_COUNT / 2) {
      break;
    }
  }

  if (batch.length) {
    console.log(
      '[source] %s - inserting batch (%s chunks, %s tweets, %s calls, %s remaining)',
      source,
      batch.length,
      inserted,
      MAX_REQUESTS - n,
      response.headers['x-rate-limit-remaining']
    );

    for (const chunk of batch) {
      const results = await Promise.all(
        chunk.map(t =>
          col.updateOne(
            { _id: t.tweet.id_str },
            {
              $addToSet: { 'search.source': source },
              $set: t,
            },
            { upsert: true }
          )
        )
      );
      const failed = results.filter(r => r.result.ok !== 1);
      if (failed.length)
        console.error(
          '[source] %s - %s/%s failed',
          source,
          failed.length,
          results.length
        );
    }

    console.log('[source] %s successfully synced!', source);
  }

  const total = await col.find(query).count();
  await onSuccess(total);
};

export const fetchTweets: Fetcher = async (account, max_id, since_id) => {
  const url = TWITTER_BASE_URL + 'statuses/home_timeline.json';
  const parameters = {
    max_id,
    since_id,
    count: TWEETS_COUNT,
    exclude_replies: false,
    include_entities: true,
    tweet_mode: 'extended',
  };

  const headers = {
    Authorization: getAuthorizationHeader(account, url, parameters),
  };
  const response = await to(
    axios.get(url + '?' + getParamString(parameters), { headers }),
    apiErrHandler(account)
  );
  return response;
};

export const fetchListTweets = (list_id): Fetcher => async (
  account,
  max_id,
  since_id
) => {
  const url = TWITTER_BASE_URL + 'lists/statuses.json';
  const parameters = {
    list_id,
    max_id,
    since_id,
    count: TWEETS_COUNT,
    include_entities: true,
    tweet_mode: 'extended',
    include_rts: true,
  };
  const headers = {
    Authorization: getAuthorizationHeader(account, url, parameters),
  };
  const response = await to(
    axios.get(url + '?' + getParamString(parameters), { headers }),
    apiErrHandler(account)
  );
  return response;
};

export async function fetchLists(account: Account): Promise<List[]> {
  const url = TWITTER_BASE_URL + 'lists/list.json';
  const headers = {
    Authorization: getAuthorizationHeader(account, url),
  };
  const response = await to(
    axios.get(url, { headers }),
    apiErrHandler(account)
  );
  const lists = response.data;
  // console.log('[%s] %s lists fetched', account.profile.username, lists.length);
  return lists.map(({ id_str, full_name }): List => ({
    id_str,
    full_name,
    accountId: account.profile.id,
  }));
}

// export async function getRemainingCalls(account: Account) {
//   const url = TWITTER_BASE_URL + 'application/rate_limit_status.json';
//   const parameters = {
//     resources: 'statuses',
//   };
//   const response = await to(
//     request({
//       url: url + '?' + getParamString(parameters),
//       json: true,
//       resolveWithFullResponse: true,
//       headers: {
//         Authorization: getAuthorizationHeader(account, url, parameters),
//       },
//     }),
//     apiErrHandler(account)
//   );
//   const rateLimits = response.toJSON().body;
//   const remainingCalls =
//     rateLimits.resources.statuses['/statuses/home_timeline'].remaining;
//   console.log(
//     '[@%s] remaining calls %s',
//     account.profile.username,
//     remainingCalls
//   );
//   return remainingCalls;
// }

function getAuthorizationHeader(account: Account, url, parameters = {}) {
  const { token, tokenSecret } = account;

  const oauth_consumer_key = config.twitter.consumerKey;
  const oauth_nonce = Math.floor(Math.random() * 10000000000);
  const oauth_signature_method = 'HMAC-SHA1';
  const oauth_token = token;
  const oauth_timestamp = Math.floor(Date.now() / 1000);
  const oauth_version = '1.0';

  parameters = {
    ...parameters,
    oauth_consumer_key,
    oauth_nonce,
    oauth_signature_method,
    oauth_token,
    oauth_timestamp,
    oauth_version,
  };
  const paramsString = getParamString(parameters);

  let signatureBaseString = 'GET';
  signatureBaseString += '&';
  signatureBaseString += encodeURIComponent(url);
  signatureBaseString += '&';
  signatureBaseString += encodeURIComponent(paramsString);

  let signingKey = '';
  signingKey += `${encodeURIComponent(config.twitter.consumerSecret)}`;
  signingKey += '&';
  signingKey += `${encodeURIComponent(tokenSecret)}`;

  const oauth_signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  let Authorization = 'OAuth ';
  Authorization += `oauth_consumer_key="${oauth_consumer_key}",`;
  Authorization += `oauth_nonce="${oauth_nonce}",`;
  Authorization += `oauth_signature="${encodeURIComponent(oauth_signature)}",`;
  Authorization += `oauth_signature_method="${oauth_signature_method}",`;
  Authorization += `oauth_timestamp="${oauth_timestamp}",`;
  Authorization += `oauth_token="${oauth_token}",`;
  Authorization += `oauth_version="${oauth_version}"`;

  return Authorization;
}
