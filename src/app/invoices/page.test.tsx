import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { clients, dayEntries, invoices, weekReports } from "@/db/schema";
import { upsertClient } from "@/db/clients";
import { insertInvoice } from "@/db/invoices";
import { submitWeekReport } from "@/db/weekReports";
import InvoicesPage from "./page";

vi.mock("./actions", () => ({ createInvoiceForMonth: vi.fn() }));

beforeEach(() => {
  const db = getDb();
  for (const table of [dayEntries, weekReports, invoices, clients]) db.delete(table).run();
});

afterEach(() => vi.unstubAllEnvs());

function seedConfig() {
  upsertClient(getDb(), {
    name: "Standard",
    hourlyRate: 1200,
    bokioCustomerId: "cust-1",
    invoiceItemName: "Konsult",
  });
  vi.stubEnv("BOKIO_TOKEN", "token");
  vi.stubEnv("BOKIO_COMPANY_ID", "company");
}

describe("InvoicesPage", () => {
  it("shows an empty state when there is nothing to invoice", () => {
    seedConfig();
    render(<InvoicesPage />);

    expect(screen.getByRole("heading", { name: "Fakturor" })).toBeInTheDocument();
    expect(screen.getByText("Inga månader att fakturera.")).toBeInTheDocument();
    expect(screen.getByText("Inga fakturor skapade ännu.")).toBeInTheDocument();
  });

  it("lists a ready month with hours and amount and an enabled button", () => {
    seedConfig();
    const db = getDb();
    db.insert(dayEntries)
      .values([
        { date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" },
        { date: "2026-10-20", type: "work", hours: 6, updatedAt: "2026-10-20T08:00:00Z" },
      ])
      .run();
    submitWeekReport(db, { year: 2026, week: 43 }, "2026-10-25T18:00:00.000Z");

    render(<InvoicesPage />);

    expect(screen.getByText("2026-10")).toBeInTheDocument();
    expect(screen.getByText(/14 h/)).toBeInTheDocument();
    expect(screen.getByText("Konsult (2026-10-01 - 2026-10-31)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skapa faktura" })).toBeEnabled();
  });

  it("blocks a month with unsubmitted weeks and explains why", () => {
    seedConfig();
    getDb()
      .insert(dayEntries)
      .values({ date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" })
      .run();

    render(<InvoicesPage />);

    expect(screen.getByText(/Veckor ej inskickade: 2026-W43/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skapa faktura" })).toBeDisabled();
  });

  it("lists already created invoices", () => {
    seedConfig();
    insertInvoice(getDb(), {
      bokioInvoiceId: "inv-7",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 120,
    });

    render(<InvoicesPage />);

    expect(screen.getByText("inv-7")).toBeInTheDocument();
    expect(screen.getByText(/120 h/)).toBeInTheDocument();
  });
});
