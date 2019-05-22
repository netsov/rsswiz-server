import * as shortid from 'shortid';
import * as jwt from 'jsonwebtoken';
import * as mailGun from 'mailgun-js';
import { isEqual } from 'lodash';
import * as fs from 'fs';
import { config } from '../config';

export * from './mongo';
export * from './amqp';
export * from './sentry';
export * from './feeds';

export const jwtSign = obj => {
  return new Promise((resolve, reject) => {
    jwt.sign(obj, config.JWT_SECRET, {}, (err, token) => {
      if (err) reject(err);
      // console.log('resolve', token);
      resolve(token);
    });
  });
};

export const setJwtCookie = (res, token) => {
  res.cookie('jwt', token, {
    domain: config.TLD,
    expires: new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000), // 90 days
    secure: false,
  });
};

export const setJwtUser = async (res, user: User, decoded?) => {
  const { _id, notifications, email } = user;
  const userToSign = {
    id: _id,
    notifications,
    email,
  };
  const keys = ['notifications', 'email'];
  if (decoded && keys.every(k => isEqual(userToSign[k], decoded[k]))) return;
  const token = await jwtSign(userToSign);
  setJwtCookie(res, token);
};

export const generateId = () => shortid.generate();

export function getParamString(parameters) {
  return Object.keys(parameters)
    .sort()
    .filter(p => !!parameters[p])
    .map(p => `${encodeURIComponent(p)}=${encodeURIComponent(parameters[p])}`)
    .join('&');
}

export function to<T>(promise: Promise<T>, handler?): Promise<T> {
  return promise
    .then(data => {
      return data;
    })
    .catch(async err => {
      if (handler) handler.then ? await handler(err) : handler(err);
      throw err;
    });
}

export const sendEmail = async (recipient, subject, text) => {
  const mailgun = mailGun({
    apiKey: config.mailgun.apiKey,
    domain: config.mailgun.domain,
  });
  const from = `RssWiz <${config.mailgun.from}>`;

  console.log('[email] sending to', recipient, subject);

  const data = {
    from,
    to: recipient,
    subject,
    text,
  };

  const res = await to(mailgun.messages().send(data));
  console.log('[email] sent to %s', recipient, res);
};

export const sendConfirmationEmail = async (recipient, confirmationId) => {
  const subject = 'RssWiz - Please confirm your email address.';
  const link = `${config.BASE_URL}/api/confirmation/${confirmationId}`;

  let text = '';
  text +=
    'Thanks for signing up for RssWiz! Please click the link below to confirm your email address.';
  text += '\n';
  text += '\n';
  text += link;
  text += '\n';
  text += '\n';
  text += 'Team RssWiz';

  await to(sendEmail(recipient, subject, text));
};

export const sendFeedEmail = async (user: User, feeds: Feed[]) => {
  if (!feeds.length) return;
  const plural = feeds.length > 1 ? 's' : '';
  const recipient = user.email && user.email.value;
  const subject = `RssWiz - Your daily RSS feed${plural}`;

  let text = `Please see the link${plural} below:`;
  text += '\n\n';
  text += feeds.map(({ _id }) => `${config.BASE_URL}/rss/${_id}`).join('\n');
  text += '\n\n';
  text += `Unsubscribe: ${config.BASE_URL}/settings`;
  text += '\n\n';
  text += 'Team RssWiz';

  await to(sendEmail(recipient, subject, text));
};

export const getUnixTimestamp = () => new Date().getTime();

export const dateStringToUnixTimeStamp = s =>
  Math.floor(new Date(s).getTime() / 1000).toString();

export const retentionTS = () => {
  const RETENTION_DAYS = config.RETENTION_DAYS;
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - RETENTION_DAYS);
  return dateStringToUnixTimeStamp(retentionDate.toString());
};

export const storeFileOnDisk = (path, content) => {
  return new Promise(resolve => {
    fs.writeFile(path, content, err => {
      if (err) throw err;
      console.log('[saved on disk]', path);
      resolve();
    });
  });
};

export const removeFileFromDisk = path => {
  return new Promise((resolve, reject) => {
    fs.unlink(path, err => {
      if (err) reject(err);
      console.log('[removed from disk]', path);
      resolve();
    });
  });
};

export const getTimestampString = (): string => Date.now().toString();
