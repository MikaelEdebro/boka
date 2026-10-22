import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  return db;
}

function databasePath() {
  if (process.env.NODE_ENV === "test") return ":memory:";
  return process.env.DATABASE_PATH ?? "./data/boka.db";
}

const globalForDb = globalThis as unknown as { __bokaDb?: Db };

export function getDb(): Db {
  globalForDb.__bokaDb ??= createDb(databasePath());
  return globalForDb.__bokaDb;
}
