import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayEntries } from "@/db/schema";
import { upsertClient } from "@/db/clients";
import { deleteInvoice, insertInvoice } from "@/db/invoices";
import { testDb } from "@/test/db";
import type { Db } from "@/db/client";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

let db: Db;
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: () => db,
}));

import { saveDay } from "./actions";

describe("saveDay", () => {
  let clientId: number;

  beforeEach(() => {
    db = testDb();
    revalidatePath.mockClear();
    clientId = upsertClient(db, {
      name: "Standard",
      hourlyRate: 1000,
      bokioCustomerId: "c1",
      invoiceItemName: "Programmering",
    }).id;
  });

  it("upserts a work day with its client and revalidates its week", async () => {
    await saveDay({ date: "2026-10-19", type: "work", hours: "8", clientId: String(clientId) });

    const rows = db.select().from(dayEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-10-19", type: "work", hours: 8, note: null, clientId });
    expect(typeof rows[0].updatedAt).toBe("string");
    expect(revalidatePath).toHaveBeenCalledWith("/week/2026-W43");
  });

  it("updates an existing entry in place and nulls the client on a non-work day", async () => {
    await saveDay({ date: "2026-10-19", type: "work", hours: "8", clientId: String(clientId) });
    await saveDay({ date: "2026-10-19", type: "vacation", hours: "", note: "ledig" });

    const rows = db.select().from(dayEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "vacation", hours: null, note: "ledig", clientId: null });
  });

  it("deletes the row when a work day is cleared", async () => {
    await saveDay({ date: "2026-10-19", type: "work", hours: "8", clientId: String(clientId) });
    await saveDay({ date: "2026-10-19", type: "work", hours: "" });

    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).toHaveBeenLastCalledWith("/week/2026-W43");
  });

  it("rejects a work day with no client without writing", async () => {
    await expect(saveDay({ date: "2026-10-19", type: "work", hours: "8" })).rejects.toThrow(
      /[Kk]und/,
    );
    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects invalid input without writing", async () => {
    await expect(saveDay({ date: "2026-10-19", type: "work", hours: "30" })).rejects.toThrow();
    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects writes to a date in an invoiced month without changing data", async () => {
    insertInvoice(db, {
      bokioInvoiceId: "inv-1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 160,
      clientId,
    });

    await expect(
      saveDay({ date: "2026-10-19", type: "work", hours: "8", clientId: String(clientId) }),
    ).rejects.toThrow("Månaden är fakturerad");
    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("allows writes once the month's invoice is removed", async () => {
    const invoice = insertInvoice(db, {
      bokioInvoiceId: "inv-1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 160,
      clientId,
    });
    deleteInvoice(db, invoice.id);

    await saveDay({ date: "2026-10-19", type: "work", hours: "8", clientId: String(clientId) });
    expect(db.select().from(dayEntries).all()).toHaveLength(1);
  });

  it("allows writes to a month next to an invoiced one", async () => {
    insertInvoice(db, {
      bokioInvoiceId: "inv-1",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 160,
      clientId,
    });

    await saveDay({ date: "2026-10-01", type: "work", hours: "8", clientId: String(clientId) });
    expect(db.select().from(dayEntries).all()).toHaveLength(1);
  });
});
