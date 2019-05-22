import * as express from 'express';
import * as passport from 'passport';

import './passportConfig';
import { setJwtUser } from '../../utils';
import { config } from '../../config';

// const loginSuccess = async ({ user }, res) => {
//   await setJwtUser(res, {
//     id: user._id,
//     notifications: user.notifications,
//   });
//   res.redirect('/');
// };

export const logout = (req, res) => {
  res.cookie('jwt', '', {
    domain: config.TLD,
    expires: new Date(0),
  });
  req.session.destroy(() => {
    res.redirect('/');
  });
};

const router = express.Router();

router.get('/logout', logout);
router.put('/logout', logout);
router.post('/logout', logout);

router.get('/twitter', passport.authenticate('twitter'));
router.post('/twitter', passport.authenticate('twitter'));

// router.get(
//   '/twitter/callback',
//   passport.authenticate('twitter', { failureRedirect: '/' }),
//   loginSuccess
// );

router.get('/twitter/callback', (req, res, next) => {
  passport.authenticate('twitter', async (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (user) {
      await setJwtUser(res, user);
    }
    const redirectUrl =
      user.feeds.length === 1 ? `/feeds/${user.feeds[0]._id}` : '/';
    res.redirect(redirectUrl);
  })(req, res, next);
});

export default router;
