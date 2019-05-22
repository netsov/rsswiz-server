import * as amqp from 'amqplib';
import { config } from '../config';

let _ch;

export const connectToRabbitMQ = async () => {
  console.log('connecting', config.rabbit.url);
  const conn = await amqp.connect(config.rabbit.url);
  console.log('connected', config.rabbit.url);
  process.once('SIGINT', () => conn.close());
  _ch = await conn.createChannel();
  await _ch.prefetch(1);
};

export const ch = () => _ch;
