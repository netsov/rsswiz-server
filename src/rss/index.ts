import { escapeRegExp } from 'lodash';
import {escape as _escape} from 'lodash';

import { db, storeFileOnDisk, to, getTimestampString } from './../utils/index';
import { getTweetsFromDb } from '../controllers/api/utils';

import {config} from "../config"

export const generateAndStoreRSS = async (
  feed: Feed,
  accounts: Account[],
  lists: List[]
) => {
  const rssId = feed._id;
  const activeAccounts = accounts.filter(account => !account.expired);

  const tweets = await to(getTweetsFromDb(feed));
  if (!tweets.length) return;

  const rssURL = `${config.BASE_URL}/rss/${rssId}`;

  const usernames = activeAccounts
    .filter(a => feed.usernames.includes(a.profile.username))
    .map(a => `@${a.profile.username}`);

  const listNames = lists
    .filter(list => activeAccounts.find(a => a.profile.id === list.accountId))
    .filter(({ id_str }) => feed.lists.includes(id_str))
    .map(({ full_name }) => full_name);

  const title = `${usernames.concat(listNames).join(', ')} Twitter Feed`;
  let description = `${tweets.length} latest tweets. `;

  let exclude = [];
  if (feed.exclude_replies) exclude.push('replies');
  if (feed.exclude_retweets) exclude.push('retweets');
  if (exclude.length) description += `Exclude: ${exclude.join(', ')}. `;

  let any = [];
  if (feed.hashtags) any = any.concat(feed.hashtags.map(h => `#${h}`));
  if (feed.url_keywords) any = any.concat(feed.url_keywords);
  if (any.length)
    description += `Hashtags/domains (any of): ${any.join(', ')}. `;

  let none = [];
  if (feed.hashtags_ne) none = none.concat(feed.hashtags_ne.map(h => `#${h}`));
  if (feed.url_keywords_ne) none = none.concat(feed.url_keywords_ne);
  if (none.length)
    description += `Hashtags/domains (none of): ${none.join(', ')}. `;


  console.log(description);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '\n';
  xml += '<rss version="2.0">';
  xml += '\n';
  xml += '<channel>';
  xml += '\n';
  xml += `<title>${_escape(title)}</title>`;
  xml += '\n';
  xml += `<link>${_escape(rssURL)}</link>`;
  xml += '\n';
  xml += `<description>${_escape(description)}</description>`;
  xml += '\n';
  xml += `<language>en-us</language>`;
  xml += '\n';
  xml += `<pubDate>${new Date().toUTCString()}</pubDate>`;
  xml += '\n';
  xml += tweets.map(generateRssItem).join('');
  xml += '</channel>';
  xml += '\n';
  xml += '</rss>';

  await storeFileOnDisk(`${config.RSS_PATH}${rssId}`, xml);
  await db()
    .collection('users')
    .findOneAndUpdate(
      { feeds: { $elemMatch: { _id: feed._id } } },
      {
        $set: {
          'feeds.$.synced': getTimestampString(),
        },
      },
      { returnOriginal: false }
    );
};

const generateRssItem = (dbTweet: DbTweet) => {
  const { tweet } = dbTweet;
  const CDATA = value => `<![CDATA[${value}]]>`;

  const sourceTweet = tweet.retweeted_status || tweet;
  const {
    created_at,
    full_text,
    id_str,
    user: { profile_image_url_https, screen_name, name },
  } = sourceTweet;
  const link = `https://twitter.com/${screen_name}/status/${id_str}`;
  const { entities: { media, urls, hashtags, user_mentions } } = sourceTweet;
  const mediaObject = media && media.length && media[0];

  let description = '<p>';
  description += `<img width="48" height="48" src="${profile_image_url_https}"/>`;
  description += '&nbsp;';
  description += `<a href="https://twitter.com/${screen_name}" target="_blank">${name}</a>`;
  description += '&nbsp;';
  description += `<a href="https://twitter.com/${screen_name}" target="_blank">@${screen_name}</a>`;
  description += '</p>';
  description += '<p>';
  description += full_text;
  description += '</p>';
  if (tweet.retweeted_status) {
    description += '<p>';
    description += `Retweeted by <a href="https://twitter.com/${tweet.user
      .screen_name}" target="_blank">${tweet.user.name}</a>`;
    description += '</p>';
  }

  if (tweet.in_reply_to_screen_name) {
    description += '<p>';
    description += `Replied to <a href="https://twitter.com/${tweet.in_reply_to_screen_name}" target="_blank">@${tweet.in_reply_to_screen_name}'s</a>&nbsp;`;
    description += `<a href="https://twitter.com/${tweet.in_reply_to_screen_name}/status/${tweet.in_reply_to_status_id_str}" target="_blank">post</a>`;
    description += '</p>';
  }

  urls.forEach(({ url, display_url }) => {
    description = description.replace(
      new RegExp(escapeRegExp(url), 'g'),
      `<a href="${url}" target="_blank">${display_url}</a>`
    );
  });

  user_mentions.forEach(({ screen_name }) => {
    description = description.replace(
      new RegExp(`@${screen_name}`, 'g'),
      `<a href="https://twitter.com/${screen_name}" target="_blank">${`@${screen_name}`}</a>`
    );
  });

  hashtags.forEach(({ text }) => {
    description = description.replace(
      new RegExp(`#${text}`, 'g'),
      `<a href="https://twitter.com/hashtag/${text}?src=hash" target="_blank">${`#${text}`}</a>`
    );
  });

  const categories = hashtags
    .map(({ text }) => `<category>${text}</category>`)
    .join('\n');

  let item = '<item>';
  item += '\n';
  item += `<title>${CDATA(full_text)}</title>`;
  item += '\n';
  item += `<description>${CDATA(description)}</description>`;
  item += '\n';
  if (mediaObject) {
    item += `<enclosure url="${mediaObject.media_url_https}" type="${mediaObject.type}" />`;
    item += '\n';
  }
  item += `<pubDate>${created_at}</pubDate>`;
  item += '\n';
  item += `<guid>${link}</guid>`;
  item += '\n';
  item += `<link>${link}</link>`;
  item += '\n';
  item += `<author>${screen_name}</author>`;
  item += '\n';
  if (categories) item += categories + '\n';
  item += '</item>';
  item += '\n';

  return item;
};
