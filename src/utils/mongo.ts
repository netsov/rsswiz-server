import { MongoClient, Db } from 'mongodb';
import { config } from '../config';

let _db: Db;

export async function getMongoClient() {
  console.log('connecting', config.mongo.URI);
  const con = await MongoClient.connect(config.mongo.URI);
  const db = con.db();
  console.log('connected', db.databaseName);
  return db;
}

export async function connectToMongoDB() {
  _db = await getMongoClient();
}

export const db = () => _db;
