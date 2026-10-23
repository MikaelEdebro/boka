import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveDay = vi.fn((..._args: unknown[]) => Promise.resolve());
const submitWeek = vi.fn((..._args: unknown[]) => Promise.resolve());
const reopenWeek = vi.fn((..._args: unknown[]) => Promise.resolve());
const applyWeekPreset = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock("./actions", () => ({
  saveDay: (...args: unknown[]) => saveDay(...args),
  submitWeek: (...args: unknown[]) => submitWeek(...args),
  reopenWeek: (...args: unknown[]) => reopenWeek(...args),
  applyWeekPreset: (...args: unknown[]) => applyWeekPreset(...args),
}));

import { WeekGrid, type WeekGridRow } from "./week-grid";

const rows: WeekGridRow[] = [
  { date: "2026-10-19", type: "work", hours: 8, note: null },
  { date: "2026-10-20", type: "work", hours: null, note: null },
];

function renderGrid(props: Partial<ComponentProps<typeof WeekGrid>> = {}) {
  return render(
    <WeekGrid
      week="2026-W43"
      rows={rows}
      submitted={false}
      submittedAt={null}
      vabNotes={[]}
      {...props}
    />,
  );
}

describe("WeekGrid", () => {
  beforeEach(() => {
    saveDay.mockClear();
    submitWeek.mockClear();
    reopenWeek.mockClear();
    applyWeekPreset.mockClear();
  });

  it("fills the whole week with work hours from the preset pill", () => {
    renderGrid();

    fireEvent.click(screen.getByRole("button", { name: "Jobbat hela veckan" }));

    expect(applyWeekPreset).toHaveBeenCalledWith("2026-W43", "work");
    // Both rows now show work 8h, so the total reflects it immediately.
    expect(screen.getByText("16")).toBeInTheDocument();
  });

  it("hides the preset pills when the week is submitted", () => {
    renderGrid({ submitted: true, submittedAt: "2026-10-25T18:00:00.000Z" });

    expect(
      screen.queryByRole("button", { name: "Jobbat hela veckan" }),
    ).not.toBeInTheDocument();
  });

  it("sums work hours across the rows", () => {
    renderGrid();
    expect(screen.getByText("Summa arbetstimmar")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders the total with tabular numerals", () => {
    renderGrid();
    expect(screen.getByText("8")).toHaveClass("tabular-nums");
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

  it("shows a note input only for VAB rows and saves the note on blur", () => {
    renderGrid();

    expect(screen.queryByLabelText("Barn 2026-10-20")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vab" },
    });

    const note = screen.getByLabelText("Barn 2026-10-20");
    expect(note).toHaveAttribute("placeholder", "Barn");

    fireEvent.change(note, { target: { value: "Stina" } });
    fireEvent.blur(note);

    expect(saveDay).toHaveBeenLastCalledWith({
      date: "2026-10-20",
      type: "vab",
      hours: "",
      note: "Stina",
    });
  });

  it("keeps the note when switching type away from VAB and back", () => {
    renderGrid();

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vab" },
    });
    fireEvent.change(screen.getByLabelText("Barn 2026-10-20"), {
      target: { value: "Otto" },
    });
    fireEvent.blur(screen.getByLabelText("Barn 2026-10-20"));

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "work" },
    });
    expect(screen.queryByLabelText("Barn 2026-10-20")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vab" },
    });
    expect(screen.getByLabelText("Barn 2026-10-20")).toHaveValue("Otto");
  });

  it("offers previously used VAB notes as datalist options", () => {
    renderGrid({ vabNotes: ["Otto", "Stina"] });

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vab" },
    });

    const note = screen.getByLabelText("Barn 2026-10-20");
    const listId = note.getAttribute("list");
    expect(listId).toBeTruthy();
    const datalist = document.getElementById(listId as string);
    expect(datalist).not.toBeNull();
    expect(datalist?.querySelectorAll("option")).toHaveLength(2);
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

  it("moves Tab from one hours input straight to the next, skipping the type dropdown", async () => {
    const user = userEvent.setup();
    renderGrid();

    const monday = screen.getByLabelText("Timmar 2026-10-19");
    const tuesday = screen.getByLabelText("Timmar 2026-10-20");
    monday.focus();

    await user.tab();

    expect(tuesday).toHaveFocus();
  });

  it("keeps the type dropdown out of the tab order", () => {
    renderGrid();

    expect(screen.getByLabelText("Typ 2026-10-19")).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus to the next hours input when Enter is pressed", async () => {
    const user = userEvent.setup();
    renderGrid();

    const monday = screen.getByLabelText("Timmar 2026-10-19");
    monday.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByLabelText("Timmar 2026-10-20")).toHaveFocus();
  });

  it("autofocuses Monday's hours input when the week is not submitted", () => {
    renderGrid();

    expect(screen.getByLabelText("Timmar 2026-10-19")).toHaveFocus();
  });

  it("reopens the week from the reopen button", () => {
    renderGrid({ submitted: true, submittedAt: "2026-10-25T18:00:00.000Z" });

    fireEvent.click(screen.getByRole("button", { name: "Öppna igen" }));

    expect(reopenWeek).toHaveBeenCalledWith("2026-W43");
  });
});
