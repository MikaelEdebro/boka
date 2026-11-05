import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { upsertClient } from "@/db/clients";
import { setVabReported, upsertDayEntry } from "@/db/dayEntries";
import { insertInvoice } from "@/db/invoices";
import { clients, dayEntries, invoices } from "@/db/schema";
import YearPage from "./page";

beforeEach(() => {
  getDb().delete(dayEntries).run();
  getDb().delete(invoices).run();
  getDb().delete(clients).run();
});

function seedClient(name = "Standard"): number {
  return upsertClient(getDb(), {
    name,
    hourlyRate: 1200,
    bokioCustomerId: "c",
    invoiceItemName: "Programmering",
  }).id;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("YearPage", () => {
  it("renders a row per month with hours and day-type counts and a totals row", async () => {
    const db = getDb();
    upsertDayEntry(db, { date: "2026-01-05", type: "work", hours: 8, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-01-06", type: "work", hours: 6, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-02-10", type: "vacation", hours: null, note: null, clientId: null }, "t");

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    expect(screen.getByRole("heading", { name: /2026/ })).toBeInTheDocument();

    const januari = screen.getByRole("row", { name: /Januari/ });
    expect(within(januari).getByText("14")).toBeInTheDocument();

    const totals = screen.getByRole("row", { name: /Totalt/ });
    expect(within(totals).getByText("14")).toBeInTheDocument();
    expect(within(totals).getByText("1")).toBeInTheDocument();
  });

  it("counts leave days in a Ledig column", async () => {
    const db = getDb();
    upsertDayEntry(db, { date: "2026-01-12", type: "leave", hours: null, note: null, clientId: null }, "t");

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    expect(screen.getByRole("columnheader", { name: "Ledig" })).toBeInTheDocument();
    const januari = screen.getByRole("row", { name: /Januari/ });
    expect(within(januari).getByText("1")).toBeInTheDocument();
  });

  it("lists every VAB day of the year in a table, grouped under month header rows", async () => {
    const db = getDb();
    upsertDayEntry(db, { date: "2026-01-05", type: "vab", hours: null, note: "Stina", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-03-10", type: "vab", hours: null, note: "Otto", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-03-11", type: "vab", hours: null, note: null, clientId: null }, "t");

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    expect(screen.getByRole("heading", { name: "VAB-dagar" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "VAB-dagar" });
    for (const header of ["Datum", "Anteckning", "Omfattning", "Rapporterad"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }

    const rows = within(table).getAllByRole("row").map((row) => row.textContent);
    expect(rows).toEqual([
      "DatumAnteckningOmfattningRapporterad",
      "Januari",
      "2026-01-05StinaHeldag",
      "Mars",
      "2026-03-10OttoHeldag",
      "2026-03-11—Heldag",
      "Totalt3 dagar · 0 rapporterade",
    ]);
    expect(within(table).getByRole("columnheader", { name: "Mars" })).toHaveAttribute("colspan", "4");
  });

  it("shows a part-time VAB day's hours and Heldag for a full-day VAB, counting one VAB day each", async () => {
    const db = getDb();
    const clientId = seedClient();
    upsertDayEntry(db, { date: "2026-10-28", type: "vab", hours: null, note: "Stina", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-10-29", type: "vab", hours: 5, note: "Joar", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-10-29", type: "work", hours: 3, note: null, clientId }, "t");

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    const table = screen.getByRole("table", { name: "VAB-dagar" });
    expect(within(table).getByRole("row", { name: /2026-10-29/ })).toHaveTextContent(
      "2026-10-29Joar5 h",
    );
    expect(within(table).getByRole("row", { name: /2026-10-28/ })).toHaveTextContent(
      "2026-10-28StinaHeldag",
    );

    const [summaryTable] = screen.getAllByRole("table");
    const oktober = within(summaryTable).getByRole("row", { name: /Oktober/ });
    const cells = within(oktober).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("3");
    expect(cells[5]).toHaveTextContent("2");
  });

  it("shows a checked Rapporterad box for a reported VAB day and counts reported days", async () => {
    const db = getDb();
    upsertDayEntry(db, { date: "2026-11-02", type: "vab", hours: null, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-11-03", type: "vab", hours: 3, note: null, clientId: null }, "t");
    setVabReported(db, "2026-11-02", true);

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    expect(screen.getByRole("checkbox", { name: "Rapporterad 2026-11-02" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Rapporterad 2026-11-03" })).not.toBeChecked();
    const table = screen.getByRole("table", { name: "VAB-dagar" });
    expect(within(table).getByRole("row", { name: /Totalt/ })).toHaveTextContent(
      "2 dagar · 1 rapporterade",
    );
  });

  it("hides the VAB table when the year has no VAB days", async () => {
    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    expect(screen.queryByRole("table", { name: "VAB-dagar" })).not.toBeInTheDocument();
  });

  it("marks invoiced months with a check and the client and hours as a title", async () => {
    const db = getDb();
    const clientId = seedClient("Kund A");
    insertInvoice(
      db,
      {
        bokioInvoiceId: "b1",
        periodStart: "2026-10-02",
        periodEnd: "2026-10-31",
        hours: 160,
        clientId,
      },
      "t",
    );

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    const oktober = screen.getByRole("row", { name: /Oktober/ });
    expect(within(oktober).getByTitle("Kund A: 160 h fakturerat 2026-10-02")).toBeInTheDocument();

    expect(within(oktober).getByLabelText("Fakturerad: Kund A")).toHaveClass("text-success");

    const januari = screen.getByRole("row", { name: /Januari/ });
    expect(within(januari).queryByTitle(/fakturerat/)).not.toBeInTheDocument();
  });

  it("shows one check per invoiced client for a month", async () => {
    const db = getDb();
    const a = seedClient("Kund A");
    const b = seedClient("Kund B");
    insertInvoice(
      db,
      { bokioInvoiceId: "b1", periodStart: "2026-10-02", periodEnd: "2026-10-31", hours: 100, clientId: a },
      "t",
    );
    insertInvoice(
      db,
      { bokioInvoiceId: "b2", periodStart: "2026-10-02", periodEnd: "2026-10-31", hours: 50, clientId: b },
      "t",
    );

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    const oktober = screen.getByRole("row", { name: /Oktober/ });
    expect(within(oktober).getByTitle("Kund A: 100 h fakturerat 2026-10-02")).toBeInTheDocument();
    expect(within(oktober).getByTitle("Kund B: 50 h fakturerat 2026-10-02")).toBeInTheDocument();
  });

  it("highlights the current month's row when showing the current year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    const oktober = screen.getByRole("row", { name: /Oktober/ });
    expect(oktober).toHaveClass("bg-highlight");

    expect(within(oktober).getByText("Oktober")).toHaveClass("text-highlight-foreground");

    const januari = screen.getByRole("row", { name: /Januari/ });
    expect(januari).not.toHaveClass("bg-highlight");
    expect(within(januari).getByText("Januari")).not.toHaveClass("text-highlight-foreground");
  });

  it("does not highlight any month when showing a different year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    render(await YearPage({ params: Promise.resolve({ year: "2025" }) }));

    const oktober = screen.getByRole("row", { name: /Oktober/ });
    expect(oktober).not.toHaveClass("bg-highlight");
  });

  it("links to the current year when showing another year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    render(await YearPage({ params: Promise.resolve({ year: "2025" }) }));

    expect(screen.getByRole("link", { name: "Aktuellt år" })).toHaveAttribute("href", "/year");
  });

  it("hides the current year link when showing the current year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    expect(screen.queryByRole("link", { name: "Aktuellt år" })).not.toBeInTheDocument();
  });

  it("renders the totals row in semibold", async () => {
    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    const totals = screen.getByRole("row", { name: /Totalt/ });
    expect(totals).toHaveClass("font-semibold");
  });

  it("links to the previous and next year", async () => {
    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    expect(screen.getByRole("link", { name: /2025/ })).toHaveAttribute("href", "/year/2025");
    expect(screen.getByRole("link", { name: /2027/ })).toHaveAttribute("href", "/year/2027");
  });
});
