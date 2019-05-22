import {
  getTweetsFromDb,
  getNewTweetsNumber,
  parseRequestQuery,
} from './utils';
import { to } from '../../utils/index';

export async function validateTweetsQuery(req, res, next) {
  const parsedParams = parseRequestQuery(req.query);
  const { usernames } = parsedParams;

  if (
    usernames &&
    !usernames.every(u => req.user.accounts.find(a => a.profile.username === u))
  ) {
    console.warn('403', req.query);
    return res.status(403).send('usernames');
  }

  req.parsedParams = parsedParams;
  next();
}

export async function tweets(req, res) {
  const rawTweets = await to(getTweetsFromDb(req.parsedParams, { _id: true }));
  const tweets = rawTweets.map(({ _id }) => _id);
  return res.status(200).json(tweets);
}

export async function newTweets(req, res) {
  const count = await to(getNewTweetsNumber(req.parsedParams));
  return res.status(200).json({ count });
}
