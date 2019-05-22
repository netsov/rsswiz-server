import * as WebSocket from 'ws';
import * as jwt from 'jsonwebtoken';
import * as cookie from 'cookie';
import { config } from './config';

import { connectToMongoDB, connectToRabbitMQ } from './utils';
import { subscribeToClientQueue } from './amqp/client';
import { to } from './utils/index';
import { db, ch, sentryConfig } from './utils';

sentryConfig(config.sentry.serverDSN);

const verifyClient = async (info, cb) => {
  const { cookie: cookieString } = info.req.headers;
  const cookies = cookieString && cookie.parse(cookieString);
  const token = cookies && cookies.jwt;
  if (!token) return cb(false, 401, 'Unauthorized');

  jwt.verify(token, config.JWT_SECRET, async (err, decoded) => {
    if (!err && decoded) {
      const user = await db()
        .collection('users')
        .findOne({ _id: decoded.id });
      if (!user) return cb(false, 401, 'Unauthorized');

      (info.req as any).user = user;
      cb(true);
    }
  });
};

(async () => {
  await connectToRabbitMQ();
  await connectToMongoDB();

  const wss = new WebSocket.Server({
    port: config.PORT_WS,
    path: '/ws/',
    verifyClient,
  });

  wss.on('connection', async (ws: WebSocket, req) => {
    const user = (req as any).user;

    const consumerTag = await to(
      subscribeToClientQueue(user)(ws),
      console.error
    );

    ws.on('close', async () => {
      console.log('ws closed unsubscribe from channel', user._id);
      await to(ch().cancel(consumerTag), console.error);
    });
  });
})();
