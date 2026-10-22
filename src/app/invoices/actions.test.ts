import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayEntries, invoices } from "@/db/schema";
import { insertInvoice } from "@/db/invoices";
import { upsertSettings } from "@/db/settings";
import { submitWeekReport } from "@/db/weekReports";
import { testDb } from "@/test/db";
import type { Db } from "@/db/client";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

let db: Db;
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: () => db,
}));

const createInvoice = vi.fn();
vi.mock("@/bokio/client", () => ({ createInvoice: (...args: unknown[]) => createInvoice(...args) }));

import { createInvoiceForMonth } from "./actions";

function configure() {
  upsertSettings(db, { hourlyRate: 1200, bokioCustomerId: "cust-1", invoiceItemName: "Konsult" });
  vi.stubEnv("BOKIO_TOKEN", "token");
  vi.stubEnv("BOKIO_COMPANY_ID", "company");
}

function seedSubmittedWorkWeek() {
  db.insert(dayEntries)
    .values([
      { date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" },
      { date: "2026-10-20", type: "work", hours: 6, updatedAt: "2026-10-20T08:00:00Z" },
    ])
    .run();
  submitWeekReport(db, { year: 2026, week: 43 }, "2026-10-25T18:00:00.000Z");
}

describe("createInvoiceForMonth", () => {
  beforeEach(() => {
    db = testDb();
    revalidatePath.mockReset();
    createInvoice.mockReset().mockResolvedValue("inv-99");
    vi.unstubAllEnvs();
  });

  it("creates a Bokio draft and records an invoices row for a fully submitted month", async () => {
    configure();
    seedSubmittedWorkWeek();

    await createInvoiceForMonth("2026-10");

    expect(createInvoice).toHaveBeenCalledWith({
      customerId: "cust-1",
      invoiceDate: "2026-10-31",
      lines: [
        { description: "Konsult (2026-10-01 - 2026-10-31)", quantity: 14, unitPrice: 1200 },
      ],
    });

    const rows = db.select().from(invoices).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      bokioInvoiceId: "inv-99",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 14,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/invoices");
  });

  it("refuses when the month has unsubmitted weeks with work hours", async () => {
    configure();
    db.insert(dayEntries)
      .values({ date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" })
      .run();

    await expect(createInvoiceForMonth("2026-10")).rejects.toThrow(/inskickad/i);
    expect(createInvoice).not.toHaveBeenCalled();
    expect(db.select().from(invoices).all()).toHaveLength(0);
  });

  it("refuses when the hourly rate is missing", async () => {
    vi.stubEnv("BOKIO_TOKEN", "token");
    vi.stubEnv("BOKIO_COMPANY_ID", "company");
    upsertSettings(db, { hourlyRate: null, bokioCustomerId: "cust-1", invoiceItemName: "Konsult" });
    seedSubmittedWorkWeek();

    await expect(createInvoiceForMonth("2026-10")).rejects.toThrow(/[Tt]impris/);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("refuses when Bokio env secrets are missing", async () => {
    upsertSettings(db, { hourlyRate: 1200, bokioCustomerId: "cust-1", invoiceItemName: "Konsult" });
    seedSubmittedWorkWeek();

    await expect(createInvoiceForMonth("2026-10")).rejects.toThrow(/\.env/);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("refuses when the month has no work hours", async () => {
    configure();

    await expect(createInvoiceForMonth("2026-10")).rejects.toThrow(/arbetstimmar/i);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("refuses when the month is already invoiced", async () => {
    configure();
    seedSubmittedWorkWeek();
    insertInvoice(db, {
      bokioInvoiceId: "old",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 14,
    });

    await expect(createInvoiceForMonth("2026-10")).rejects.toThrow(/redan/i);
    expect(createInvoice).not.toHaveBeenCalled();
    expect(db.select().from(invoices).all()).toHaveLength(1);
  });

  it("rejects an invalid month param", async () => {
    configure();

    await expect(createInvoiceForMonth("2026-13")).rejects.toThrow(/[Oo]giltig/);
    expect(createInvoice).not.toHaveBeenCalled();
  });
});
