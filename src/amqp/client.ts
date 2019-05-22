import * as WebSocket from 'ws';

import { subscribeToQueue } from './utils';
import { to, generateId, db, ch } from '../utils';

import { mainExchange, clientQueue, clientRK } from './';

export const subscribeToClientQueue = user => async (ws: WebSocket) => {
  const handleWorkerMessage = (ws: WebSocket) => async msg => {
    ws.send(JSON.stringify(msg));
  };

  const consumerTag = generateId();
  await to(
    subscribeToQueue({
      queueName: clientQueue(user._id),
      routingKey: clientRK(user._id),
      exchange: mainExchange(),
      queueOptions: { autoDelete: true, durable: false },
      consumeOptions: { consumerTag, noAck: true },
      handler: handleWorkerMessage(ws),
    })
  );

  return consumerTag;
};
