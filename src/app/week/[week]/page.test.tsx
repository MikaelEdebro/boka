import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { dayEntries } from "@/db/schema";
import WeekPage from "./page";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));
vi.mock("next/navigation", () => ({ notFound }));

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

  it("calls notFound for an invalid week param", async () => {
    await expect(renderWeek("not-a-week")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
