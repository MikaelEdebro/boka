import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { clients, dayEntries, invoices, weekReports } from "@/db/schema";
import { upsertClient } from "@/db/clients";
import { insertInvoice, updateInvoiceStatus } from "@/db/invoices";
import { submitWeekReport } from "@/db/weekReports";
import type { BokioInvoiceList } from "./bokio-invoices";
import InvoicesPage from "./page";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const refreshInvoiceStatuses = vi.fn(async () => ({ ok: true }) as const);
vi.mock("./actions", () => ({
  createInvoiceForMonth: vi.fn(),
  linkInvoice: vi.fn(),
  refreshInvoiceStatuses: () => refreshInvoiceStatuses(),
}));

const loadBokioInvoiceList = vi.fn<() => Promise<BokioInvoiceList>>();
vi.mock("./bokio-invoices", () => ({ loadBokioInvoiceList: () => loadBokioInvoiceList() }));

beforeEach(() => {
  const db = getDb();
  for (const table of [dayEntries, weekReports, invoices, clients]) db.delete(table).run();
  refreshInvoiceStatuses.mockClear();
  loadBokioInvoiceList.mockReset().mockResolvedValue({ ok: true, invoices: [] });
});

afterEach(() => vi.unstubAllEnvs());

function seedConfig(name = "Standard") {
  const client = upsertClient(getDb(), {
    name,
    hourlyRate: 1200,
    bokioCustomerId: "cust-1",
    invoiceItemName: "Konsult",
  });
  vi.stubEnv("BOKIO_TOKEN", "token");
  vi.stubEnv("BOKIO_COMPANY_ID", "company");
  return client.id;
}

describe("InvoicesPage", () => {
  it("shows an empty state when there is nothing to invoice", async () => {
    seedConfig();
    render(await InvoicesPage());

    expect(screen.getByRole("heading", { name: "Fakturor" })).toBeInTheDocument();
    expect(screen.getByText("Inga månader att fakturera.")).toBeInTheDocument();
    expect(screen.getByText("Inga fakturor skapade ännu.")).toBeInTheDocument();
  });

  it("lists a ready month with hours and amount and an enabled button", async () => {
    const clientId = seedConfig();
    const db = getDb();
    db.insert(dayEntries)
      .values([
        { date: "2026-10-19", type: "work", hours: 8, clientId, updatedAt: "2026-10-19T08:00:00Z" },
        { date: "2026-10-20", type: "work", hours: 6, clientId, updatedAt: "2026-10-20T08:00:00Z" },
      ])
      .run();
    submitWeekReport(db, { year: 2026, week: 43 }, "2026-10-25T18:00:00.000Z");

    render(await InvoicesPage());

    expect(screen.getByText(/2026-10 · Standard/)).toBeInTheDocument();
    expect(screen.getByText(/14 h/)).toBeInTheDocument();
    expect(screen.getByText("Konsult (2026-10-01 - 2026-10-31)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skapa faktura" })).toBeEnabled();
  });

  it("lists one row per client for a month with two clients", async () => {
    const db = getDb();
    const a = upsertClient(db, {
      name: "Kund A",
      hourlyRate: 1000,
      bokioCustomerId: "a",
      invoiceItemName: "Konsult",
    });
    const b = upsertClient(db, {
      name: "Kund B",
      hourlyRate: 800,
      bokioCustomerId: "b",
      invoiceItemName: "Konsult",
    });
    vi.stubEnv("BOKIO_TOKEN", "token");
    vi.stubEnv("BOKIO_COMPANY_ID", "company");
    db.insert(dayEntries)
      .values([
        { date: "2026-10-19", type: "work", hours: 8, clientId: a.id, updatedAt: "t" },
        { date: "2026-10-20", type: "work", hours: 5, clientId: b.id, updatedAt: "t" },
      ])
      .run();
    submitWeekReport(db, { year: 2026, week: 43 }, "2026-10-25T18:00:00.000Z");

    render(await InvoicesPage());

    expect(screen.getByText(/2026-10 · Kund A/)).toBeInTheDocument();
    expect(screen.getByText(/2026-10 · Kund B/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Skapa faktura" })).toHaveLength(2);
  });

  it("blocks a month with unsubmitted weeks and explains why", async () => {
    const clientId = seedConfig();
    getDb()
      .insert(dayEntries)
      .values({ date: "2026-10-19", type: "work", hours: 8, clientId, updatedAt: "2026-10-19T08:00:00Z" })
      .run();

    render(await InvoicesPage());

    expect(screen.getByText(/Veckor ej inskickade: 2026-W43/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skapa faktura" })).toBeDisabled();
  });

  it("lists already created invoices with the client name", async () => {
    const clientId = seedConfig();
    insertInvoice(getDb(), {
      bokioInvoiceId: "inv-7",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 120,
      clientId,
    });

    render(await InvoicesPage());

    expect(screen.getByText("inv-7")).toBeInTheDocument();
    expect(screen.getByText(/2026-09 · Standard/)).toBeInTheDocument();
    expect(screen.getByText(/120 h/)).toBeInTheDocument();
  });

  it("shows the stored Bokio status badge, invoice number and checked time", async () => {
    const clientId = seedConfig();
    const invoice = insertInvoice(getDb(), {
      bokioInvoiceId: "inv-7",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 120,
      clientId,
    });
    updateInvoiceStatus(getDb(), invoice.id, {
      bokioStatus: "published",
      bokioInvoiceNumber: "456",
      statusCheckedAt: "2026-10-23T09:30:00.000Z",
    });

    render(await InvoicesPage());

    expect(screen.getByText("Publicerad")).toBeInTheDocument();
    expect(screen.getByText(/Fakturanr 456/)).toBeInTheDocument();
    expect(screen.getByText(/Kontrollerad 2026-10-23/)).toBeInTheDocument();
  });

  it("auto-refreshes statuses when an invoice has never been checked", async () => {
    const clientId = seedConfig();
    insertInvoice(getDb(), {
      bokioInvoiceId: "inv-7",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 120,
      clientId,
    });

    render(await InvoicesPage());

    expect(refreshInvoiceStatuses).toHaveBeenCalledTimes(1);
  });

  it("does not auto-refresh when statuses were checked recently", async () => {
    const clientId = seedConfig();
    const invoice = insertInvoice(getDb(), {
      bokioInvoiceId: "inv-7",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 120,
      clientId,
    });
    updateInvoiceStatus(getDb(), invoice.id, {
      bokioStatus: "draft",
      bokioInvoiceNumber: null,
      statusCheckedAt: new Date().toISOString(),
    });

    render(await InvoicesPage());

    expect(refreshInvoiceStatuses).not.toHaveBeenCalled();
  });

  describe("linking to an existing Bokio invoice", () => {
    function seedAugust(clientId: number, hours = [8, 6]) {
      const db = getDb();
      db.insert(dayEntries)
        .values(
          hours.map((h, i) => ({
            date: `2026-08-${String(3 + i).padStart(2, "0")}`,
            type: "work" as const,
            hours: h,
            clientId,
            updatedAt: "t",
          })),
        )
        .run();
      submitWeekReport(db, { year: 2026, week: 32 }, "2026-08-09T18:00:00.000Z");
    }

    function handMadeInvoice(quantity: number, description = "Konsult (2026-08-01 - 2026-08-31)") {
      return {
        id: "inv-45",
        invoiceNumber: "45",
        status: "paid",
        invoiceDate: "2026-09-04",
        customerId: "cust-1",
        lineItems: [{ description, quantity, unitType: "hour", unitPrice: 1200 }],
      };
    }

    it("offers to link a matching Bokio invoice with equal hours", async () => {
      seedAugust(seedConfig());
      loadBokioInvoiceList.mockResolvedValue({ ok: true, invoices: [handMadeInvoice(14)] });

      render(await InvoicesPage());

      expect(screen.getByRole("button", { name: "Koppla till Bokio-faktura #45" })).toBeEnabled();
      expect(screen.getByText("Betald")).toBeInTheDocument();
      const hours = screen.getByText("14 h i Bokio · 14 h i Boka");
      expect(hours.closest("p")?.className).toMatch(/green/);
      expect(screen.getByRole("button", { name: "Skapa faktura" })).toBeInTheDocument();
    });

    it("warns when Bokio hours differ from Boka hours", async () => {
      seedAugust(seedConfig());
      loadBokioInvoiceList.mockResolvedValue({ ok: true, invoices: [handMadeInvoice(16)] });

      render(await InvoicesPage());

      const hours = screen.getByText("16 h i Bokio · 14 h i Boka");
      expect(hours.closest("p")?.className).toMatch(/amber/);
    });

    it("warns about a weak date-only match", async () => {
      seedAugust(seedConfig());
      loadBokioInvoiceList.mockResolvedValue({
        ok: true,
        invoices: [handMadeInvoice(14, "Konsult")],
      });

      render(await InvoicesPage());

      expect(screen.getByText("Datum matchar men fakturaraden saknar period")).toBeInTheDocument();
    });

    it("does not suggest an invoice that is already linked", async () => {
      const clientId = seedConfig();
      seedAugust(clientId);
      insertInvoice(getDb(), {
        bokioInvoiceId: "inv-45",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        hours: 1,
        clientId,
      });
      loadBokioInvoiceList.mockResolvedValue({ ok: true, invoices: [handMadeInvoice(14)] });

      render(await InvoicesPage());

      expect(screen.queryByRole("button", { name: /Koppla till/ })).not.toBeInTheDocument();
    });

    it("degrades to a muted note when Bokio invoices cannot be loaded", async () => {
      seedAugust(seedConfig());
      loadBokioInvoiceList.mockResolvedValue({ ok: false, error: "Bokio svarade 500" });

      render(await InvoicesPage());

      expect(screen.getByText(/Kunde inte hämta fakturor från Bokio/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Skapa faktura" })).toBeEnabled();
    });

    it("marks linked invoices in the invoice list", async () => {
      const clientId = seedConfig();
      insertInvoice(getDb(), {
        bokioInvoiceId: "inv-45",
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        hours: 14,
        clientId,
        linked: true,
        statusCheckedAt: new Date().toISOString(),
      });

      render(await InvoicesPage());

      expect(screen.getByText("Kopplad")).toBeInTheDocument();
    });
  });
});
