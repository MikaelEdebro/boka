import type { Db } from "@/db/client";
import { settings, type Theme } from "@/db/schema";

const SETTINGS_ID = 1;

export type AppSettings = { theme: Theme };

const DEFAULT_SETTINGS: AppSettings = { theme: "system" };

export function getSettings(db: Db): AppSettings {
  const row = db.select().from(settings).get();
  return row ? { theme: row.theme } : DEFAULT_SETTINGS;
}

export function upsertSettings(db: Db, values: AppSettings): void {
  db.insert(settings)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({ target: settings.id, set: values })
    .run();
}
