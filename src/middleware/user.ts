import * as jwt from 'jsonwebtoken';
import { setJwtUser, db } from '../utils';
import {config} from '../config'

export const userMiddleware = async (req, res, next) => {
  const token = req.cookies.jwt || req.headers.authorization;
  console.log('token', token);
  if (token) {
    jwt.verify(token, config.JWT_SECRET, async (err, decoded) => {
      if (!err && decoded) {
        const user: User = await db()
          .collection('users')
          .findOne({ _id: decoded.id });
        if (user) {
          req.user = user;
          await setJwtUser(res, user, decoded);
        } else {
          req.invalidToken = true;
        }
      }
      next();
    });
  } else {
    next();
  }
};
