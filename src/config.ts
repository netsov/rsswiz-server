require('dotenv').config();

const minute = 60000;

export const config = {
  sessionSecret: process.env.SESSION_SECRET || 'SESSION_SECRET',
  TLD: process.env.TLD || '.rsswiz.test',
  PORT: parseInt(process.env.PORT || '3001', 10),
  PORT_WS: parseInt(process.env.PORT_WS || '3002', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  BASE_URL: process.env.BASE_URL || 'http://www.rsswiz.test',
  JWT_SECRET: process.env.JWT_SECRET || 'JWT_SECRET',
  RETENTION_DAYS: parseInt(process.env.RETENTION_DAYS || '10', 10),
  RSS_PATH: process.env.RSS_PATH || '/Users/netsov/rss/',

  mongo: {
    URI: process.env.MONGODB_URI
  },

  sentry: {
    serverDSN: process.env.SENTRY_DSN_SERVER,
    workerDSN: process.env.SENTRY_DSN_WORKER,
  },

  worker: {
    syncTTL: parseInt(process.env.MQ_SYNC_TTL, 10) || minute * 10,
    schedulerTTL: parseInt(process.env.MQ_SCHEDULER_TTL, 10) || minute * 5,
    retentionTTL: parseInt(process.env.MQ_RETENTION_TTL, 10) || minute * 10,
  },

  mailgun: {
    apiKey: process.env.MG_API_KEY,
    domain: process.env.MG_DOMAIN,
    from: process.env.MG_FROM,
  },

  rabbit: {
    url:
      process.env.RABBITMQ_URL,
  },

  twitter: {
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: process.env.TWITTER_CALLBACK_URL,
  },
};

console.log('config', JSON.stringify(config, null, 2));
