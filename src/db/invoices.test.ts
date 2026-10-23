import { describe, expect, it } from "vitest";
import { dayEntries } from "@/db/schema";
import { upsertClient } from "@/db/clients";
import { deleteInvoice, getWorkDays, insertInvoice, listInvoices, updateInvoiceStatus } from "@/db/invoices";
import { testDb } from "@/test/db";
import type { Db } from "@/db/client";

function seedClient(db: Db): number {
  return upsertClient(db, {
    name: "Standard",
    hourlyRate: 1200,
    bokioCustomerId: "cust-1",
    invoiceItemName: "Programmering",
  }).id;
}

describe("invoices db", () => {
  it("stores a linked invoice with its Bokio status and number", () => {
    const db = testDb();
    const clientId = seedClient(db);
    const invoice = insertInvoice(db, {
      bokioInvoiceId: "inv-45",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      hours: 112,
      clientId,
      bokioStatus: "paid",
      bokioInvoiceNumber: "45",
      statusCheckedAt: "2026-10-23T09:00:00.000Z",
      linked: true,
    });
    expect(invoice).toMatchObject({ bokioStatus: "paid", bokioInvoiceNumber: "45", linked: true });
  });

  it("marks created invoices as not linked by default", () => {
    const db = testDb();
    const invoice = insertInvoice(db, {
      bokioInvoiceId: "inv-1",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      hours: 1,
      clientId: seedClient(db),
    });
    expect(invoice.linked).toBe(false);
  });

  it("inserts an invoice row and returns it", () => {
    const db = testDb();
    const clientId = seedClient(db);
    const invoice = insertInvoice(
      db,
      {
        bokioInvoiceId: "inv-42",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        hours: 120,
        clientId,
      },
      "2026-11-01T09:00:00.000Z",
    );
    expect(invoice).toMatchObject({
      bokioInvoiceId: "inv-42",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 120,
      clientId,
      createdAt: "2026-11-01T09:00:00.000Z",
    });
    expect(invoice.id).toBeTypeOf("number");
  });

  it("lists invoices newest period first", () => {
    const db = testDb();
    const clientId = seedClient(db);
    insertInvoice(db, {
      bokioInvoiceId: "a",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 100,
      clientId,
    });
    insertInvoice(db, {
      bokioInvoiceId: "b",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 120,
      clientId,
    });
    expect(listInvoices(db).map((i) => i.periodStart)).toEqual(["2026-10-01", "2026-09-01"]);
  });

  it("updates the Bokio status columns of an invoice row", () => {
    const db = testDb();
    const clientId = seedClient(db);
    const invoice = insertInvoice(db, {
      bokioInvoiceId: "inv-1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 120,
      clientId,
    });
    expect(invoice.bokioStatus).toBeNull();

    updateInvoiceStatus(db, invoice.id, {
      bokioStatus: "published",
      bokioInvoiceNumber: "123",
      statusCheckedAt: "2026-11-01T09:00:00.000Z",
    });

    const [row] = listInvoices(db);
    expect(row).toMatchObject({
      bokioStatus: "published",
      bokioInvoiceNumber: "123",
      statusCheckedAt: "2026-11-01T09:00:00.000Z",
    });
  });

  it("deletes a single invoice row by id", () => {
    const db = testDb();
    const clientId = seedClient(db);
    const values = { periodEnd: "2026-10-31", hours: 120, clientId };
    const kept = insertInvoice(db, { ...values, bokioInvoiceId: "a", periodStart: "2026-09-01" });
    const removed = insertInvoice(db, { ...values, bokioInvoiceId: "b", periodStart: "2026-10-01" });

    deleteInvoice(db, removed.id);

    expect(listInvoices(db).map((i) => i.id)).toEqual([kept.id]);
  });

  it("returns only work-day entries with their client", () => {
    const db = testDb();
    const clientId = seedClient(db);
    db.insert(dayEntries)
      .values([
        { date: "2026-10-19", type: "work", hours: 8, clientId, updatedAt: "2026-10-19T08:00:00Z" },
        { date: "2026-10-21", type: "vacation", hours: null, updatedAt: "2026-10-21T08:00:00Z" },
      ])
      .run();

    const workDays = getWorkDays(db);
    expect(workDays).toEqual([{ date: "2026-10-19", type: "work", hours: 8, clientId }]);
  });
});
