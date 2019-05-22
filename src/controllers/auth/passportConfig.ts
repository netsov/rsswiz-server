import * as passport from 'passport';
import { Strategy as TwitterStrategy } from 'passport-twitter';

import {
  generateId,
  to,
  db,
  generateNewFeed,
  sanitizeUserFeeds,
} from '../../utils/index';
import { TwitterLogoutWarning } from '../../utils/notifications';
import { notifyWorkers } from '../../amqp/utils';
import { config } from '../../config';

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(async (req, user, done) => {
  done(null, null);
});

const verify = async (req, token, tokenSecret, profile, cb) => {
  const account = {
    token,
    tokenSecret,
    profile,
  };
  let user: User;
  const usersCol = db().collection('users');
  const existingTwitterUser = await usersCol.findOne({
    accounts: { $elemMatch: { 'profile.id': profile.id } },
  });

  if (req.user) {
    if (existingTwitterUser) {
      if (existingTwitterUser._id === req.user._id) {
        console.log(
          'existing twitter account found and it matches logged in user. updating...'
        );

        const accountToUpdate = req.user.accounts.find(
          a => a.profile.id === profile.id
        );

        const r = await usersCol.findOneAndUpdate(
          { accounts: { $elemMatch: { 'profile.id': profile.id } } },
          {
            $set: {
              'accounts.$': account,
            },
          },
          { returnOriginal: false }
        );
        user = r.value;

        if (!accountToUpdate.expired) {
          user = await TwitterLogoutWarning(req.user, profile.username).push();
        }
      } else {
        console.log(
          "existing twitter account found and it doesn't match logged in user. error..."
        );

        const prevOwner = await usersCol.findOneAndUpdate(
          { accounts: { $elemMatch: { 'profile.id': profile.id } } },
          {
            $pull: {
              accounts: { 'profile.id': profile.id },
              lists: { accountId: profile.id },
            },
          },
          { returnOriginal: false }
        );
        await sanitizeUserFeeds(prevOwner.value);

        const r = await usersCol.findOneAndUpdate(
          { _id: req.user._id },
          {
            $push: {
              accounts: account,
            },
          },
          { returnOriginal: false }
        );
        user = r.value;

        // user = await LinkedToAnotherAccountError(
        //   req.user,
        //   db,
        //   profile.username
        // ).push();
      }
    } else {
      console.log(
        'adding new twitter account to the logged in user. updating...'
      );
      const r = await usersCol.findOneAndUpdate(
        { _id: req.user._id },
        {
          $push: {
            accounts: account,
            // 'feed.usernames': account.profile.username,
          },
        },
        { returnOriginal: false }
      );
      user = r.value;
    }
  } else {
    if (existingTwitterUser) {
      console.log('existing twitter account found. logging in...');

      const r = await usersCol.findOneAndUpdate(
        { accounts: { $elemMatch: { 'profile.id': profile.id } } },
        {
          $set: {
            'accounts.$': account,
          },
        },
        { returnOriginal: false }
      );
      user = r.value;
    } else {
      console.log('creating new user...');
      const newUser: User = {
        _id: generateId(),
        accounts: [account],
        feeds: [generateNewFeed(account.profile.username)],
        lists: [],
        email: { value: '', confirmed: false },
        schedule: { times: [] },
      };
      const r = await usersCol.insertOne(newUser);
      user = r.result.ok ? r.ops[0] : null;
    }
  }

  if (user) await to(notifyWorkers(user._id), console.error);
  cb(null, user);
};

passport.use(
  new TwitterStrategy(
    {
      consumerKey: config.twitter.consumerKey,
      consumerSecret: config.twitter.consumerSecret,
      callbackURL: config.twitter.callbackURL,
      passReqToCallback: true,
      userAuthorizationURL: 'https://api.twitter.com/oauth/authorize',
    },
    verify
  )
);
