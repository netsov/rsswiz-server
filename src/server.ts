import * as express from 'express';
import * as passport from 'passport';
import * as morgan from 'morgan';
import * as session from 'express-session';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as Raven from 'raven';
import { config } from './config';

import { connectToMongoDB, connectToRabbitMQ, sentryConfig } from './utils';
import * as middleware from './middleware';
import controllers from './controllers';

const sentryOn = sentryConfig(config.sentry.serverDSN);

(async () => {
  await connectToMongoDB();
  await connectToRabbitMQ();

  const app = express();
  app.set('etag', false);

  console.log('[NODE_ENV]', config.NODE_ENV);

  if (sentryOn) app.use(Raven.requestHandler());

  app.use(
    morgan(
      ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]'
    )
  );
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(cookieParser());

  app.use(middleware.userMiddleware);

  const MongoStore = require('connect-mongo')(session);
  app.use(
    session({
      resave: true,
      saveUninitialized: true,
      secret: config.sessionSecret,
      cookie: { domain: config.TLD },
      store: new MongoStore({
        url: config.mongo.URI,
        autoReconnect: true,
        clear_interval: 3600,
      }),
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(controllers);
  if (sentryOn) app.use(Raven.errorHandler());

  app.listen(config.PORT, err => {
    if (err) throw err;
    console.log(`[listen] ${config.PORT}`);
  });
})();
