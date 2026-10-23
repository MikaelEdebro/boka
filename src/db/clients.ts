import { asc, count, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { clients, dayEntries, invoices, type Client } from "@/db/schema";

export const DEFAULT_INVOICE_ITEM_NAME = "Programmering";

export type ClientValues = {
  name: string;
  hourlyRate: number;
  bokioCustomerId: string;
  invoiceItemName: string;
};

export function listClients(db: Db): Client[] {
  return db.select().from(clients).orderBy(asc(clients.id)).all();
}

export function getClient(db: Db, id: number): Client | undefined {
  return db.select().from(clients).where(eq(clients.id, id)).get();
}

export function getDefaultClient(db: Db): Client | undefined {
  return db.select().from(clients).where(eq(clients.isDefault, true)).get();
}

export function upsertClient(db: Db, values: ClientValues & { id?: number }): Client {
  const { id, ...fields } = values;

  if (id != null) {
    return db.update(clients).set(fields).where(eq(clients.id, id)).returning().get();
  }

  const isFirst = db.select({ value: count() }).from(clients).get()?.value === 0;
  return db
    .insert(clients)
    .values({ ...fields, isDefault: isFirst, createdAt: new Date().toISOString() })
    .returning()
    .get();
}

export function setDefaultClient(db: Db, id: number): void {
  db.transaction((tx) => {
    tx.update(clients).set({ isDefault: false }).run();
    tx.update(clients).set({ isDefault: true }).where(eq(clients.id, id)).run();
  });
}

export function deleteClient(db: Db, id: number): void {
  const client = getClient(db, id);
  if (!client) return;

  if (client.isDefault && hasRecordedData(db)) {
    throw new Error("Kunden har tidrapporter eller fakturor och kan inte tas bort.");
  }

  db.delete(clients).where(eq(clients.id, id)).run();

  if (client.isDefault) {
    const next = db.select().from(clients).orderBy(asc(clients.id)).get();
    if (next) setDefaultClient(db, next.id);
  }
}

function hasRecordedData(db: Db): boolean {
  const dayCount = db.select({ value: count() }).from(dayEntries).get()?.value ?? 0;
  const invoiceCount = db.select({ value: count() }).from(invoices).get()?.value ?? 0;
  return dayCount > 0 || invoiceCount > 0;
}
