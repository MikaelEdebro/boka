import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { upsertDayEntry } from "@/db/dayEntries";
import { insertInvoice } from "@/db/invoices";
import { dayEntries, invoices } from "@/db/schema";
import YearPage from "./page";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

beforeEach(() => {
  getDb().delete(dayEntries).run();
  getDb().delete(invoices).run();
});

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

  it("lists every VAB day of the year with date and note, grouped by month", async () => {
    const db = getDb();
    upsertDayEntry(db, { date: "2026-01-05", type: "vab", hours: null, note: "Stina", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-03-10", type: "vab", hours: null, note: "Otto", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-03-11", type: "vab", hours: null, note: null, clientId: null }, "t");

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    const vab = screen.getByRole("heading", { name: "VAB-dagar" });
    expect(vab).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "VAB-dagar" });
    expect(within(list).getByText(/2026-01-05/)).toBeInTheDocument();
    expect(within(list).getByText(/Stina/)).toBeInTheDocument();
    expect(within(list).getByText(/2026-03-10/)).toBeInTheDocument();
    expect(within(list).getByText(/Otto/)).toBeInTheDocument();
    expect(within(list).getByText(/2026-03-11/)).toBeInTheDocument();
  });

  it("marks invoiced months with a check and the invoiced hours as a title", async () => {
    const db = getDb();
    insertInvoice(
      db,
      { bokioInvoiceId: "b1", periodStart: "2026-10-02", periodEnd: "2026-10-31", hours: 160 },
      "t",
    );

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    const oktober = screen.getByRole("row", { name: /Oktober/ });
    expect(within(oktober).getByTitle("160 h fakturerat 2026-10-02")).toBeInTheDocument();

    const januari = screen.getByRole("row", { name: /Januari/ });
    expect(within(januari).queryByTitle(/fakturerat/)).not.toBeInTheDocument();
  });

  it("highlights the current month's row when showing the current year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    const oktober = screen.getByRole("row", { name: /Oktober/ });
    expect(oktober).toHaveClass("bg-muted/50");

    const januari = screen.getByRole("row", { name: /Januari/ });
    expect(januari).not.toHaveClass("bg-muted/50");
  });

  it("does not highlight any month when showing a different year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    render(await YearPage({ params: Promise.resolve({ year: "2025" }) }));

    const oktober = screen.getByRole("row", { name: /Oktober/ });
    expect(oktober).not.toHaveClass("bg-muted/50");
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
