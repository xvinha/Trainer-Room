import dotenv from 'dotenv';
dotenv.config();

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema-sqlite';

const DB_FILE = process.env.SQLITE_FILE || './data/trainer_room.sqlite';

const fs = await import('node:fs');
const path = await import('node:path');
const dir = path.dirname(DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const sqliteClient = new Database(DB_FILE);
sqliteClient.run('PRAGMA journal_mode = WAL');
sqliteClient.run('PRAGMA foreign_keys = ON');

export const db = drizzle(sqliteClient, { schema });
export { schema };

export const dbKind = 'sqlite' as const;

export const sqlClient = {
  unsafe: (sql: string, params?: any[]) => {
    if (params && params.length) {
      return sqliteClient.query(sql).all(...params);
    }
    return sqliteClient.query(sql).all();
  },
};
