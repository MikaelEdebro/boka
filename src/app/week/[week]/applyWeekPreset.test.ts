import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayEntries } from "@/db/schema";
import { upsertClient } from "@/db/clients";
import { upsertDayEntry } from "@/db/dayEntries";
import { insertInvoice } from "@/db/invoices";
import { testDb } from "@/test/db";
import type { Db } from "@/db/client";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

let db: Db;
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: () => db,
}));

import { applyWeekPreset } from "./actions";

function rowsByDate() {
  return Object.fromEntries(
    db
      .select()
      .from(dayEntries)
      .all()
      .map((row) => [row.date, row]),
  );
}

describe("applyWeekPreset", () => {
  let defaultClientId: number;

  beforeEach(() => {
    db = testDb();
    revalidatePath.mockReset();
    defaultClientId = upsertClient(db, {
      name: "Standard",
      hourlyRate: 1000,
      bokioCustomerId: "c1",
      invoiceItemName: "Programmering",
    }).id;
  });

  it("writes work 8h Mon–Fri billed to the default client and clears the weekend", async () => {
    await applyWeekPreset("2026-W43", "work");

    const rows = rowsByDate();
    for (const date of ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]) {
      expect(rows[date]).toMatchObject({ type: "work", hours: 8, clientId: defaultClientId });
    }
    expect(rows["2026-10-24"]).toBeUndefined();
    expect(rows["2026-10-25"]).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/week/2026-W43");
  });

  it("replaces existing entries and clears days the preset empties", async () => {
    upsertDayEntry(db, { date: "2026-10-24", type: "work", hours: 5, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-10-19", type: "sick", hours: null, note: null, clientId: null }, "t");

    await applyWeekPreset("2026-W43", "vacation");

    const rows = rowsByDate();
    expect(rows["2026-10-19"]).toMatchObject({ type: "vacation", hours: null });
    expect(rows["2026-10-24"]).toBeUndefined();
  });

  it("keeps a red day as holiday when filling the week", async () => {
    await applyWeekPreset("2026-W01", "work");

    const rows = rowsByDate();
    expect(rows["2026-01-01"]).toMatchObject({ type: "holiday" });
    expect(rows["2025-12-29"]).toMatchObject({ type: "work", hours: 8 });
  });

  it("clears every entry for the clear preset", async () => {
    upsertDayEntry(db, { date: "2026-10-20", type: "vab", hours: null, note: null, clientId: null }, "t");

    await applyWeekPreset("2026-W43", "clear");

    expect(db.select().from(dayEntries).all()).toHaveLength(0);
  });

  it("skips the days of an invoiced month and fills the open ones", async () => {
    // 2026-W40 runs 2026-09-28 – 2026-10-04; September is invoiced.
    insertInvoice(db, {
      bokioInvoiceId: "inv-1",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 160,
      clientId: defaultClientId,
    });
    upsertDayEntry(db, { date: "2026-09-28", type: "sick", hours: null, note: null, clientId: null }, "t");

    await applyWeekPreset("2026-W40", "work");

    const rows = rowsByDate();
    expect(rows["2026-09-28"]).toMatchObject({ type: "sick" });
    expect(rows["2026-09-29"]).toBeUndefined();
    expect(rows["2026-09-30"]).toBeUndefined();
    expect(rows["2026-10-01"]).toMatchObject({ type: "work", hours: 8 });
    expect(rows["2026-10-02"]).toMatchObject({ type: "work", hours: 8 });
  });

  it("leaves an invoiced month untouched by the clear preset", async () => {
    insertInvoice(db, {
      bokioInvoiceId: "inv-1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 160,
      clientId: defaultClientId,
    });
    upsertDayEntry(db, { date: "2026-10-20", type: "vab", hours: null, note: null, clientId: null }, "t");

    await applyWeekPreset("2026-W43", "clear");

    expect(rowsByDate()["2026-10-20"]).toMatchObject({ type: "vab" });
  });

  it("rejects an invalid week param", async () => {
    await expect(applyWeekPreset("nope", "work")).rejects.toThrow(/[Oo]giltig/);
  });
});
