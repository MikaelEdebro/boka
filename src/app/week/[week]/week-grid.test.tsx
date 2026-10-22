import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveDay = vi.fn(() => Promise.resolve());
vi.mock("./actions", () => ({ saveDay: (...args: unknown[]) => saveDay(...args) }));

import { WeekGrid, type WeekGridRow } from "./week-grid";

const rows: WeekGridRow[] = [
  { date: "2026-10-19", type: "work", hours: 8, note: null },
  { date: "2026-10-20", type: "work", hours: null, note: null },
];

describe("WeekGrid", () => {
  beforeEach(() => saveDay.mockClear());

  it("sums work hours across the rows", () => {
    render(<WeekGrid rows={rows} />);
    expect(screen.getByText("Summa arbetstimmar")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("saves and shows an indicator when the type changes", async () => {
    render(<WeekGrid rows={rows} />);

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
    render(<WeekGrid rows={rows} />);

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
});
