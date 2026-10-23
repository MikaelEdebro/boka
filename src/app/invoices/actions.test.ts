import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayEntries, invoices, type Client } from "@/db/schema";
import { upsertClient } from "@/db/clients";
import { insertInvoice } from "@/db/invoices";
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
const getInvoice = vi.fn();
vi.mock("@/bokio/client", () => ({
  createInvoice: (...args: unknown[]) => createInvoice(...args),
  getInvoice: (...args: unknown[]) => getInvoice(...args),
}));

import { createInvoiceForMonth, refreshInvoiceStatuses } from "./actions";

function addClient(values: Partial<Omit<Client, "id" | "isDefault" | "createdAt">> = {}): Client {
  return upsertClient(db, {
    name: values.name ?? "Standard",
    hourlyRate: values.hourlyRate ?? 1200,
    bokioCustomerId: values.bokioCustomerId ?? "cust-1",
    invoiceItemName: values.invoiceItemName ?? "Konsult",
  });
}

let defaultClientId: number;

function configure() {
  defaultClientId = addClient().id;
  vi.stubEnv("BOKIO_TOKEN", "token");
  vi.stubEnv("BOKIO_COMPANY_ID", "company");
}

function seedSubmittedWorkWeek(clientId = defaultClientId) {
  db.insert(dayEntries)
    .values([
      { date: "2026-10-19", type: "work", hours: 8, clientId, updatedAt: "2026-10-19T08:00:00Z" },
      { date: "2026-10-20", type: "work", hours: 6, clientId, updatedAt: "2026-10-20T08:00:00Z" },
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

    const result = await createInvoiceForMonth("2026-10", defaultClientId);

    expect(result).toEqual({ ok: true });
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
      clientId: defaultClientId,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/invoices");
  });

  it("creates one invoice per client for the same month", async () => {
    vi.stubEnv("BOKIO_TOKEN", "token");
    vi.stubEnv("BOKIO_COMPANY_ID", "company");
    const a = addClient({ name: "A", bokioCustomerId: "cust-a", hourlyRate: 1000, invoiceItemName: "A-rad" });
    const b = addClient({ name: "B", bokioCustomerId: "cust-b", hourlyRate: 800, invoiceItemName: "B-rad" });
    db.insert(dayEntries)
      .values([
        { date: "2026-10-19", type: "work", hours: 8, clientId: a.id, updatedAt: "t" },
        { date: "2026-10-20", type: "work", hours: 5, clientId: b.id, updatedAt: "t" },
      ])
      .run();
    submitWeekReport(db, { year: 2026, week: 43 }, "2026-10-25T18:00:00.000Z");

    createInvoice.mockReset().mockResolvedValueOnce("inv-a").mockResolvedValueOnce("inv-b");

    expect(await createInvoiceForMonth("2026-10", a.id)).toEqual({ ok: true });
    expect(await createInvoiceForMonth("2026-10", b.id)).toEqual({ ok: true });

    expect(createInvoice).toHaveBeenNthCalledWith(1, {
      customerId: "cust-a",
      invoiceDate: "2026-10-31",
      lines: [{ description: "A-rad (2026-10-01 - 2026-10-31)", quantity: 8, unitPrice: 1000 }],
    });
    expect(createInvoice).toHaveBeenNthCalledWith(2, {
      customerId: "cust-b",
      invoiceDate: "2026-10-31",
      lines: [{ description: "B-rad (2026-10-01 - 2026-10-31)", quantity: 5, unitPrice: 800 }],
    });

    const rows = db.select().from(invoices).all();
    expect(rows.map((r) => [r.bokioInvoiceId, r.clientId, r.hours])).toEqual([
      ["inv-a", a.id, 8],
      ["inv-b", b.id, 5],
    ]);
  });

  it("refuses a second invoice for the same month and client", async () => {
    configure();
    seedSubmittedWorkWeek();

    expect(await createInvoiceForMonth("2026-10", defaultClientId)).toEqual({ ok: true });

    createInvoice.mockClear();
    const result = await createInvoiceForMonth("2026-10", defaultClientId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/redan/i);
    expect(createInvoice).not.toHaveBeenCalled();
    expect(db.select().from(invoices).all()).toHaveLength(1);
  });

  it("refuses when the month has unsubmitted weeks with work hours", async () => {
    configure();
    db.insert(dayEntries)
      .values({
        date: "2026-10-19",
        type: "work",
        hours: 8,
        clientId: defaultClientId,
        updatedAt: "2026-10-19T08:00:00Z",
      })
      .run();

    const result = await createInvoiceForMonth("2026-10", defaultClientId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/inskickad/i);
    expect(createInvoice).not.toHaveBeenCalled();
    expect(db.select().from(invoices).all()).toHaveLength(0);
  });

  it("refuses when the client does not exist", async () => {
    vi.stubEnv("BOKIO_TOKEN", "token");
    vi.stubEnv("BOKIO_COMPANY_ID", "company");
    const client = addClient();
    seedSubmittedWorkWeek(client.id);

    const result = await createInvoiceForMonth("2026-10", client.id + 999);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/[Kk]unden finns inte/);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("refuses when Bokio env secrets are missing", async () => {
    const client = addClient();
    seedSubmittedWorkWeek(client.id);

    const result = await createInvoiceForMonth("2026-10", client.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/\.env/);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("refuses when the month has no work hours", async () => {
    configure();

    const result = await createInvoiceForMonth("2026-10", defaultClientId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/arbetstimmar/i);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("rejects an invalid month param", async () => {
    configure();

    const result = await createInvoiceForMonth("2026-13", defaultClientId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/[Oo]giltig/);
    expect(createInvoice).not.toHaveBeenCalled();
  });
});

describe("refreshInvoiceStatuses", () => {
  beforeEach(() => {
    db = testDb();
    revalidatePath.mockReset();
    getInvoice.mockReset();
    vi.unstubAllEnvs();
  });

  function seedInvoice(bokioInvoiceId: string, clientId: number) {
    return insertInvoice(db, {
      bokioInvoiceId,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      hours: 10,
      clientId,
    });
  }

  it("updates every stored invoice with its live Bokio status", async () => {
    defaultClientId = addClient().id;
    vi.stubEnv("BOKIO_TOKEN", "token");
    vi.stubEnv("BOKIO_COMPANY_ID", "company");
    const row = seedInvoice("inv-1", defaultClientId);
    getInvoice.mockResolvedValue({
      status: "published",
      invoiceNumber: "123",
      totalAmount: 12000,
      paidAmount: 0,
      dueDate: "2026-11-30",
      publishedDateTime: "2026-10-31T10:00:00Z",
    });

    const result = await refreshInvoiceStatuses();

    expect(result).toEqual({ ok: true });
    expect(getInvoice).toHaveBeenCalledWith("inv-1");
    const updated = db.select().from(invoices).all()[0];
    expect(updated).toMatchObject({
      id: row.id,
      bokioStatus: "published",
      bokioInvoiceNumber: "123",
    });
    expect(updated.statusCheckedAt).toBeTypeOf("string");
    expect(revalidatePath).toHaveBeenCalledWith("/invoices");
  });

  it("marks an invoice deleted when Bokio no longer has it (404 → null)", async () => {
    defaultClientId = addClient().id;
    vi.stubEnv("BOKIO_TOKEN", "token");
    vi.stubEnv("BOKIO_COMPANY_ID", "company");
    seedInvoice("gone", defaultClientId);
    getInvoice.mockResolvedValue(null);

    expect(await refreshInvoiceStatuses()).toEqual({ ok: true });

    const updated = db.select().from(invoices).all()[0];
    expect(updated.bokioStatus).toBe("deleted");
    expect(updated.bokioInvoiceNumber).toBeNull();
  });

  it("refuses when Bokio env secrets are missing", async () => {
    defaultClientId = addClient().id;
    seedInvoice("inv-1", defaultClientId);

    const result = await refreshInvoiceStatuses();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/\.env/);
    expect(getInvoice).not.toHaveBeenCalled();
  });
});
