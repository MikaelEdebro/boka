import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveDay = vi.fn((..._args: unknown[]) => Promise.resolve());
const submitWeek = vi.fn((..._args: unknown[]) => Promise.resolve());
const reopenWeek = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock("./actions", () => ({
  saveDay: (...args: unknown[]) => saveDay(...args),
  submitWeek: (...args: unknown[]) => submitWeek(...args),
  reopenWeek: (...args: unknown[]) => reopenWeek(...args),
}));

import { WeekGrid, type WeekGridRow } from "./week-grid";

const rows: WeekGridRow[] = [
  { date: "2026-10-19", type: "work", hours: 8, note: null },
  { date: "2026-10-20", type: "work", hours: null, note: null },
];

function renderGrid(props: Partial<ComponentProps<typeof WeekGrid>> = {}) {
  return render(
    <WeekGrid week="2026-W43" rows={rows} submitted={false} submittedAt={null} {...props} />,
  );
}

describe("WeekGrid", () => {
  beforeEach(() => {
    saveDay.mockClear();
    submitWeek.mockClear();
    reopenWeek.mockClear();
  });

  it("sums work hours across the rows", () => {
    renderGrid();
    expect(screen.getByText("Summa arbetstimmar")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("saves and shows an indicator when the type changes", async () => {
    renderGrid();

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vacation" },
    });

    expect(saveDay).toHaveBeenCalledWith({
      date: "2026-10-20",
      type: "vacation",
      hours: "",
      note: "",
    });
    expect(await screen.findByText("Sparat")).toBeInTheDocument();
  });

  it("saves hours on blur and updates the total", () => {
    renderGrid();

    const input = screen.getByLabelText("Timmar 2026-10-20");
    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.blur(input);

    expect(saveDay).toHaveBeenCalledWith({
      date: "2026-10-20",
      type: "work",
      hours: "4",
      note: "",
    });
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("submits the week from the submit button", () => {
    renderGrid();

    fireEvent.click(screen.getByRole("button", { name: "Skicka in vecka" }));

    expect(submitWeek).toHaveBeenCalledWith("2026-W43");
  });

  it("locks the inputs and shows the submitted date when submitted", () => {
    renderGrid({ submitted: true, submittedAt: "2026-10-25T18:00:00.000Z" });

    expect(screen.getByLabelText("Typ 2026-10-19")).toBeDisabled();
    expect(screen.getByLabelText("Timmar 2026-10-19")).toBeDisabled();
    expect(screen.getByText("Inskickad 2026-10-25")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Skicka in vecka" }),
    ).not.toBeInTheDocument();
  });

  it("reopens the week from the reopen button", () => {
    renderGrid({ submitted: true, submittedAt: "2026-10-25T18:00:00.000Z" });

    fireEvent.click(screen.getByRole("button", { name: "Öppna igen" }));

    expect(reopenWeek).toHaveBeenCalledWith("2026-W43");
  });
});
