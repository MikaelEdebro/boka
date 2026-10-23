import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { dayEntries } from "@/db/schema";
import WeekPage from "./page";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

afterEach(() => {
  vi.useRealTimers();
});

function renderWeek(week: string) {
  return WeekPage({ params: Promise.resolve({ week }) });
}

describe("WeekPage", () => {
  it("renders the week heading and all seven weekdays", async () => {
    render(await renderWeek("2026-W43"));

    expect(
      screen.getByRole("heading", { name: "Vecka 43, 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Måndag")).toBeInTheDocument();
    expect(screen.getByText("Söndag")).toBeInTheDocument();
    expect(screen.getByText("2026-10-19")).toBeInTheDocument();
    expect(screen.getByText("2026-10-25")).toBeInTheDocument();
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

    expect(screen.getByLabelText("Timmar 2026-10-19")).toHaveValue(8);
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

    expect(screen.getByRole("link", { name: "Aktuell vecka" })).toHaveAttribute(
      "href",
      "/week",
    );
  });

  it("hides the current week link when showing the current week", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));

    render(await renderWeek("2026-W43"));

    expect(screen.queryByRole("link", { name: "Aktuell vecka" })).not.toBeInTheDocument();
  });

  it("calls notFound for an invalid week param", async () => {
    await expect(renderWeek("not-a-week")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("pre-fills a weekday red day as holiday with 0 hours", async () => {
    render(await renderWeek("2026-W01"));

    expect(screen.getByLabelText("Typ 2026-01-01")).toHaveValue("holiday");
    expect(screen.getByLabelText("Timmar 2026-01-01")).toHaveValue(0);
    // A normal weekday in the same week is left as an empty work day.
    expect(screen.getByLabelText("Typ 2026-01-02")).toHaveValue("work");
    expect(screen.getByLabelText("Timmar 2026-01-02")).toHaveValue(null);
  });

  it("leaves a red day that falls on a weekend empty", async () => {
    render(await renderWeek("2026-W23"));

    expect(screen.getByLabelText("Typ 2026-06-06")).toHaveValue("work");
    expect(screen.getByLabelText("Timmar 2026-06-06")).toHaveValue(null);
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
    expect(screen.getByLabelText("Timmar 2026-01-01")).toHaveValue(8);
  });
});
