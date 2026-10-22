import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const DAY_TYPES = ["work", "vacation", "vab", "sick", "parental", "holiday"] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const dayEntries = sqliteTable("day_entries", {
  date: text("date").primaryKey(),
  type: text("type", { enum: DAY_TYPES }).notNull(),
  hours: real("hours"),
  note: text("note"),
  updatedAt: text("updated_at").notNull(),
});

export const weekReports = sqliteTable(
  "week_reports",
  {
    isoYear: integer("iso_year").notNull(),
    isoWeek: integer("iso_week").notNull(),
    submittedAt: text("submitted_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.isoYear, t.isoWeek] })],
);

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  hourlyRate: real("hourly_rate"),
  bokioCustomerId: text("bokio_customer_id"),
  invoiceItemName: text("invoice_item_name"),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bokioInvoiceId: text("bokio_invoice_id").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  hours: real("hours").notNull(),
  createdAt: text("created_at").notNull(),
});

export type DayEntry = typeof dayEntries.$inferSelect;
export type WeekReport = typeof weekReports.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
