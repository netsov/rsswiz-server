import { to, db, generateNewFeed, removeFileFromDisk, getTimestampString } from '../../utils';
import { notifyWorkers } from '../../amqp/utils';
import {config} from "../../config"

export const getFeeds = (req, res) => {
  return res.status(200).json(req.user.feeds || []);
};

export const getFeed = async (req, res) => {
  const feed = (req.user as User).feeds.find(
    feed => feed._id === req.params.feedId
  );
  if (!feed) return res.status(404).send();
  return res.status(200).json(feed);
};

export const updateFeed = async ({ body, user, params: { feedId } }, res) => {
  const payload = Object.keys(body).reduce(
    (prev, next) => ({ ...prev, [`feeds.$.${next}`]: body[next] }),
    {}
  );
  const updated = await db()
    .collection('users')
    .findOneAndUpdate(
      { _id: user._id, feeds: { $elemMatch: { _id: feedId } } },
      { $set: { ...payload, 'feeds.$.updated': getTimestampString() } },
      { returnOriginal: false }
    );

  let updatedUser = updated.value;
  if (!updatedUser) return res.status(404).send();

  await to(notifyWorkers(updatedUser._id, feedId), console.error);

  return res
    .status(200)
    .json(updatedUser.feeds.find(feed => feed._id === feedId));
};

export const createFeed = async ({ user }, res) => {
  const alreadyCreated = user.feeds.find(feed => !feed.updated);

  if (alreadyCreated) return res.redirect(`/feeds/${alreadyCreated._id}`);

  const feed = generateNewFeed();
  const updated = await db()
    .collection('users')
    .findOneAndUpdate(
      { _id: user._id },
      { $push: { feeds: feed } },
      { returnOriginal: false }
    );

  if (!updated.value) return res.status(404).send();

  return res.redirect(`/feeds/${feed._id}`);
};

export const deleteFeed = async ({ user, params: { feedId } }, res) => {
  const updated = await db()
    .collection('users')
    .findOneAndUpdate(
      { _id: user._id, feeds: { $elemMatch: { _id: feedId } } },
      { $pull: { feeds: { _id: feedId } } },
      { returnOriginal: false }
    );

  if (!updated.value) return res.status(404).send();

  try {
    await removeFileFromDisk(`${config.RSS_PATH}${feedId}`);
  } catch (err) {
    console.error(err);
  }

  return res.status(200).send();
};
