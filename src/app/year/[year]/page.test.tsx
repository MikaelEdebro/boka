import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { upsertDayEntry } from "@/db/dayEntries";
import { dayEntries } from "@/db/schema";
import YearPage from "./page";

beforeEach(() => {
  getDb().delete(dayEntries).run();
});

describe("YearPage", () => {
  it("renders a row per month with hours and day-type counts and a totals row", async () => {
    const db = getDb();
    upsertDayEntry(db, { date: "2026-01-05", type: "work", hours: 8, note: null }, "t");
    upsertDayEntry(db, { date: "2026-01-06", type: "work", hours: 6, note: null }, "t");
    upsertDayEntry(db, { date: "2026-02-10", type: "vacation", hours: null, note: null }, "t");

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
    upsertDayEntry(db, { date: "2026-01-12", type: "leave", hours: null, note: null }, "t");

    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    expect(screen.getByRole("columnheader", { name: "Ledig" })).toBeInTheDocument();
    const januari = screen.getByRole("row", { name: /Januari/ });
    expect(within(januari).getByText("1")).toBeInTheDocument();
  });

  it("links to the previous and next year", async () => {
    render(await YearPage({ params: Promise.resolve({ year: "2026" }) }));

    expect(screen.getByRole("link", { name: /2025/ })).toHaveAttribute("href", "/year/2025");
    expect(screen.getByRole("link", { name: /2027/ })).toHaveAttribute("href", "/year/2027");
  });
});
