import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { settings } from "@/db/schema";

const SETTINGS_ID = 1;

export const DEFAULT_INVOICE_ITEM_NAME = "Konsulttjänster";

export type AppSettings = {
  hourlyRate: number | null;
  bokioCustomerId: string;
  invoiceItemName: string;
};

export function getSettings(db: Db): AppSettings {
  const row = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
  return {
    hourlyRate: row?.hourlyRate ?? null,
    bokioCustomerId: row?.bokioCustomerId ?? "",
    invoiceItemName: row?.invoiceItemName ?? DEFAULT_INVOICE_ITEM_NAME,
  };
}

export function upsertSettings(db: Db, values: AppSettings): void {
  db.insert(settings)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({
      target: settings.id,
      set: values,
    })
    .run();
}
