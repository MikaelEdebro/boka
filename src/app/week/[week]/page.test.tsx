import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { upsertClient } from "@/db/clients";
import { insertInvoice } from "@/db/invoices";
import { clients, dayEntries, invoices } from "@/db/schema";
import WeekPage from "./page";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));
vi.mock("next/navigation", () => ({ notFound }));

beforeEach(() => {
  getDb().delete(dayEntries).run();
  getDb().delete(invoices).run();
  getDb().delete(clients).run();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderWeek(week: string) {
  return WeekPage({ params: Promise.resolve({ week }) });
}

describe("WeekPage", () => {
  it("renders the week heading and only Monday–Friday when no client shows weekends", async () => {
    upsertClient(getDb(), {
      name: "Standard",
      hourlyRate: 1000,
      bokioCustomerId: "c1",
      invoiceItemName: "Programmering",
    });

    render(await renderWeek("2026-W43"));

    expect(
      screen.getByRole("heading", { name: "Vecka 43, 2026" }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Timmar /)).toHaveLength(5);
    expect(screen.getByText("Måndag")).toBeInTheDocument();
    expect(screen.getByText("Fredag")).toBeInTheDocument();
    expect(screen.queryByText("Lördag")).not.toBeInTheDocument();
    expect(screen.queryByText("Söndag")).not.toBeInTheDocument();
    expect(screen.getByText("2026-10-19")).toBeInTheDocument();
    expect(screen.getByText("2026-10-23")).toBeInTheDocument();
  });

  it("renders all seven days when a client shows weekends", async () => {
    upsertClient(getDb(), {
      name: "Helg",
      hourlyRate: 1000,
      bokioCustomerId: "c1",
      invoiceItemName: "Programmering",
      showWeekends: true,
    });

    render(await renderWeek("2026-W43"));

    expect(screen.getAllByLabelText(/^Timmar /)).toHaveLength(7);
    expect(screen.getByText("Lördag")).toBeInTheDocument();
    expect(screen.getByText("Söndag")).toBeInTheDocument();
    expect(screen.getByText("2026-10-25")).toBeInTheDocument();
  });

  it("shows a Saturday that already has an entry even when weekends are off", async () => {
    getDb()
      .insert(dayEntries)
      .values([{ date: "2026-10-24", type: "work", hours: 3, updatedAt: "2026-10-24T08:00:00Z" }])
      .run();

    render(await renderWeek("2026-W43"));

    expect(screen.getAllByLabelText(/^Timmar /)).toHaveLength(6);
    expect(screen.getByText("Lördag")).toBeInTheDocument();
    expect(screen.getByLabelText("Timmar 2026-10-24")).toHaveValue("3");
    expect(screen.queryByText("Söndag")).not.toBeInTheDocument();
  });

  it("renders seeded day entries and sums work hours", async () => {
    const db = getDb();
    db.insert(dayEntries)
      .values([
        { date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" },
        { date: "2026-10-20", type: "work", hours: 6, updatedAt: "2026-10-20T08:00:00Z" },
        { date: "2026-10-21", type: "vacation", hours: null, updatedAt: "2026-10-21T08:00:00Z" },
      ])
      .run();

    render(await renderWeek("2026-W43"));

    expect(screen.getByLabelText("Timmar 2026-10-19")).toHaveValue("8");
    expect(screen.getByLabelText("Typ 2026-10-21")).toHaveValue("vacation");
    expect(screen.getByText("Summa arbetstimmar")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("has links to the previous and next week", async () => {
    render(await renderWeek("2026-W43"));

    expect(screen.getByRole("link", { name: /Föregående/ })).toHaveAttribute(
      "href",
      "/week/2026-W42",
    );
    expect(screen.getByRole("link", { name: /Nästa/ })).toHaveAttribute(
      "href",
      "/week/2026-W44",
    );
  });

  it("links to the current week when showing another week", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));

    render(await renderWeek("2026-W40"));

    expect(screen.getByRole("link", { name: "Gå till aktuell vecka" })).toHaveAttribute(
      "href",
      "/week",
    );
    expect(screen.queryByText("Aktuell vecka")).not.toBeInTheDocument();
  });

  it("shows a current week badge instead of the link on the current week", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));

    render(await renderWeek("2026-W43"));

    expect(screen.queryByRole("link", { name: /aktuell vecka/i })).not.toBeInTheDocument();
    expect(screen.getByText("Aktuell vecka").closest("a")).toBeNull();
  });

  it("calls notFound for an invalid week param", async () => {
    await expect(renderWeek("not-a-week")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("pre-fills a weekday red day as holiday with 0 hours", async () => {
    render(await renderWeek("2026-W01"));

    expect(screen.getByLabelText("Typ 2026-01-01")).toHaveValue("holiday");
    expect(screen.getByLabelText("Timmar 2026-01-01")).toHaveValue("0");
    // A normal weekday in the same week is left as an empty work day.
    expect(screen.getByLabelText("Typ 2026-01-02")).toHaveValue("work");
    expect(screen.getByLabelText("Timmar 2026-01-02")).toHaveValue("");
  });

  it("leaves a red day that falls on a shown weekend empty", async () => {
    upsertClient(getDb(), {
      name: "Helg",
      hourlyRate: 1000,
      bokioCustomerId: "c1",
      invoiceItemName: "Programmering",
      showWeekends: true,
    });

    render(await renderWeek("2026-W23"));

    expect(screen.getByLabelText("Typ 2026-06-06")).toHaveValue("work");
    expect(screen.getByLabelText("Timmar 2026-06-06")).toHaveValue("");
  });

  it("keeps a saved entry on a red day instead of the pre-fill", async () => {
    const db = getDb();
    db.insert(dayEntries)
      .values([
        { date: "2026-01-01", type: "work", hours: 8, updatedAt: "2026-01-01T08:00:00Z" },
      ])
      .run();

    render(await renderWeek("2026-W01"));

    expect(screen.getByLabelText("Typ 2026-01-01")).toHaveValue("work");
    expect(screen.getByLabelText("Timmar 2026-01-01")).toHaveValue("8");
  });

  it("locks the days of an invoiced month and leaves the rest of the week open", async () => {
    const db = getDb();
    const client = upsertClient(db, {
      name: "Standard",
      hourlyRate: 1000,
      bokioCustomerId: "c1",
      invoiceItemName: "Programmering",
    });
    insertInvoice(db, {
      bokioInvoiceId: "inv-sep",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      hours: 160,
      clientId: client.id,
    });

    render(await renderWeek("2026-W40"));

    expect(screen.getByLabelText("Timmar 2026-09-30")).toBeDisabled();
    expect(screen.getByLabelText("Timmar 2026-10-01")).toBeEnabled();
    expect(screen.getAllByText("Fakturerad")).toHaveLength(3);
  });

  it("renders a part-time VAB day as a VAB row and a work row, totalling only the work", async () => {
    const db = getDb();
    const client = upsertClient(db, {
      name: "Standard",
      hourlyRate: 1000,
      bokioCustomerId: "c1",
      invoiceItemName: "Programmering",
    });
    db.insert(dayEntries)
      .values([
        { date: "2026-10-29", type: "vab", hours: 5, note: "Joar", updatedAt: "t" },
        { date: "2026-10-29", type: "work", hours: 3, clientId: client.id, updatedAt: "t" },
      ])
      .run();

    render(await renderWeek("2026-W44"));

    expect(screen.getByLabelText("Typ 2026-10-29")).toHaveValue("vab_part");
    expect(screen.getByLabelText("Timmar 2026-10-29")).toHaveValue("5");
    expect(screen.getByLabelText("Kommentar 2026-10-29")).toHaveValue("Joar");
    expect(screen.getByLabelText("Timmar arbete 2026-10-29")).toHaveValue("3");
    expect(screen.getAllByText("2026-10-29")).toHaveLength(1);
    const total = screen.getByText("Summa arbetstimmar").closest("tr") as HTMLElement;
    expect(total).toHaveTextContent("3");
  });
});
