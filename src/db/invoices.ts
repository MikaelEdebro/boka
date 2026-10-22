import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { dayEntries, invoices, type DayType, type Invoice } from "@/db/schema";

export type NewInvoice = {
  bokioInvoiceId: string;
  periodStart: string;
  periodEnd: string;
  hours: number;
};

export function listInvoices(db: Db): Invoice[] {
  return db.select().from(invoices).orderBy(desc(invoices.periodStart)).all();
}

export function insertInvoice(
  db: Db,
  values: NewInvoice,
  createdAt: string = new Date().toISOString(),
): Invoice {
  return db
    .insert(invoices)
    .values({ ...values, createdAt })
    .returning()
    .get();
}

export type WorkDay = { date: string; type: DayType; hours: number | null };

export function getWorkDays(db: Db): WorkDay[] {
  return db
    .select({ date: dayEntries.date, type: dayEntries.type, hours: dayEntries.hours })
    .from(dayEntries)
    .where(eq(dayEntries.type, "work"))
    .all();
}
