import * as Raven from 'raven';
import { Options } from 'amqplib';

import { mainExchange, workersRK } from './';
import { to, ch } from '../utils';
import {config} from "../config"

interface subscribeToQueueOptions {
  queueName: string;
  exchange?: string;
  routingKey?: string;
  handler: (parsedContent: object) => Promise<any>;
  queueOptions?: Options.AssertQueue;
  errorHandler?: (parsedContent: object, e: Error) => Promise<any>;
  consumeOptions?: Options.Consume;
}

export const subscribeToQueue = async (options: subscribeToQueueOptions) => {
  const {
    queueName,
    exchange,
    routingKey,
    handler,
    queueOptions = {},
    consumeOptions = {},
    errorHandler,
  } = options;

  const sentryOn = !!config.sentry.workerDSN;
  const ok = await ch().assertQueue(queueName, queueOptions);
  if (exchange) await ch().assertExchange(exchange, 'direct');
  if (routingKey) await ch().bindQueue(queueName, exchange, routingKey);

  console.log('[Consuming messages]', JSON.stringify(ok));
  ch().consume(
    queueName,
    async msg => {
      const content = msg.content.toString();
      // console.log("[Received] '%s' from '%s'", content, queueName);
      const parsedContent = JSON.parse(content);

      try {
        await to(handler(parsedContent));
      } catch (e) {
        console.error(e);
        console.error(
          'failed to handle message',
          handler.name,
          parsedContent,
          e.name,
          e.message
        );
        if (sentryOn) Raven.captureException(e);
        if (errorHandler) {
          await to(errorHandler(parsedContent, e));
          if (!consumeOptions.noAck) ch().ack(msg);
        }
        return;
      }
      if (!consumeOptions.noAck) ch().ack(msg);
    },
    consumeOptions
  );
};

export const sendMessageTTL = async ({
  queueNameTTL,
  deadLetterRoutingKey,
  ttl,
  msg,
}) => {
  const options = {
    deadLetterExchange: mainExchange(),
    deadLetterRoutingKey,
    autoDelete: true,
    durable: false,
    expires: parseInt(ttl, 10) + 5 * 1000, // destroy after 5 sec message being dead lettered
  };
  const q = await ch().assertQueue(queueNameTTL, options);

  if (q && q.messageCount > 0) {
    return;
  }

  await ch().sendToQueue(queueNameTTL, Buffer.from(JSON.stringify(msg)), {
    expiration: parseInt(ttl, 10),
  });
};

export const notifyWorkers = async (userId: string, feedId?: string) => {
  // makes sure there will be a consumer for that queue
  const msg = { userId, feedId };

  const sent = ch().publish(
    mainExchange(),
    workersRK(),
    Buffer.from(JSON.stringify(msg))
  );
  console.log('[notify] sent to workers', sent);
};
