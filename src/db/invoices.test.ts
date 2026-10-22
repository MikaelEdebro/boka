import { describe, expect, it } from "vitest";
import { dayEntries } from "@/db/schema";
import { getWorkDays, insertInvoice, listInvoices } from "@/db/invoices";
import { testDb } from "@/test/db";

describe("invoices db", () => {
  it("inserts an invoice row and returns it", () => {
    const db = testDb();
    const invoice = insertInvoice(
      db,
      {
        bokioInvoiceId: "inv-42",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        hours: 120,
      },
      "2026-11-01T09:00:00.000Z",
    );
    expect(invoice).toMatchObject({
      bokioInvoiceId: "inv-42",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 120,
      createdAt: "2026-11-01T09:00:00.000Z",
    });
    expect(invoice.id).toBeTypeOf("number");
  });

  it("lists invoices newest period first", () => {
    const db = testDb();
    insertInvoice(db, {
      bokioInvoiceId: "a",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 100,
    });
    insertInvoice(db, {
      bokioInvoiceId: "b",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 120,
    });
    expect(listInvoices(db).map((i) => i.periodStart)).toEqual(["2026-10-01", "2026-09-01"]);
  });

  it("returns only work-day entries", () => {
    const db = testDb();
    db.insert(dayEntries)
      .values([
        { date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" },
        { date: "2026-10-21", type: "vacation", hours: null, updatedAt: "2026-10-21T08:00:00Z" },
      ])
      .run();

    const workDays = getWorkDays(db);
    expect(workDays).toEqual([{ date: "2026-10-19", type: "work", hours: 8 }]);
  });
});
