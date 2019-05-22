import * as express from 'express';

import { tweets, newTweets, validateTweetsQuery } from './tweets';
import { accounts } from './accounts';
import { getFeed, getFeeds, updateFeed, createFeed, deleteFeed } from './feeds';
import { schedule, updateSchedule } from './schedule';
import { deleteNotification } from './notifications';
import {
  updateEmail,
  createConfirmation,
  verifyConfirmationLink,
} from './email';
import { secure } from '../../middleware';

const router = express.Router();

router.get('/tweets', secure, validateTweetsQuery, tweets);
router.get('/tweets/new', secure, validateTweetsQuery, newTweets);

router.get('/accounts', secure, accounts);

router.get('/feeds', secure, getFeeds);
router.get('/feeds/:feedId', secure, getFeed);
router.put('/feeds/:feedId', secure, updateFeed);
router.delete('/feeds/:feedId', secure, deleteFeed);
router.post('/feeds', secure, createFeed);

router.get('/schedule', secure, schedule);
router.put('/schedule', secure, updateSchedule);

router.put('/email', secure, updateEmail);
router.post('/confirmation', secure, createConfirmation);
router.get('/confirmation/:confirmationId', verifyConfirmationLink);

router.delete('/notifications/:notificationId', secure, deleteNotification);

export default router;
