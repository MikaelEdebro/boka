import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { upsertClient } from "@/db/clients";
import { getYearEntries, upsertDayEntry } from "@/db/dayEntries";
import { insertInvoice } from "@/db/invoices";
import { testDb } from "@/test/db";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

let db: Db;
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: () => db,
}));

import { setVabDayReported } from "./actions";

function vabReported(date: string): boolean | undefined {
  return getYearEntries(db, Number(date.slice(0, 4))).find(
    (entry) => entry.date === date && entry.type === "vab",
  )?.reported;
}

describe("setVabDayReported", () => {
  beforeEach(() => {
    db = testDb();
    revalidatePath.mockClear();
    upsertDayEntry(db, { date: "2026-11-02", type: "vab", hours: null, note: "Joar", clientId: null });
  });

  it("checks and unchecks a VAB day and revalidates its year", async () => {
    expect(await setVabDayReported("2026-11-02", true)).toEqual({ ok: true });
    expect(vabReported("2026-11-02")).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/year/2026");

    expect(await setVabDayReported("2026-11-02", false)).toEqual({ ok: true });
    expect(vabReported("2026-11-02")).toBe(false);
  });

  it("toggles a VAB day in an invoiced month", async () => {
    const clientId = upsertClient(db, {
      name: "Standard",
      hourlyRate: 1000,
      bokioCustomerId: "c1",
      invoiceItemName: "Programmering",
    }).id;
    insertInvoice(db, {
      bokioInvoiceId: "inv-1",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      hours: 160,
      clientId,
    });

    expect(await setVabDayReported("2026-11-02", true)).toEqual({ ok: true });
    expect(vabReported("2026-11-02")).toBe(true);
  });

  it("fails for a date without a VAB day", async () => {
    expect(await setVabDayReported("2026-11-03", true)).toEqual({
      ok: false,
      error: "Ingen VAB-dag 2026-11-03.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("fails for an invalid date", async () => {
    expect(await setVabDayReported("igår", true)).toEqual({ ok: false, error: "Ogiltigt datum." });
  });
});
