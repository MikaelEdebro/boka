import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

import { WeekGrid, type WeekGridRow } from "./week-grid";

const rows: WeekGridRow[] = [
  { date: "2026-10-19", type: "work", hours: 8, note: null, clientId: 1 },
  { date: "2026-10-20", type: "work", hours: null, note: null, clientId: 1 },
];

function renderGrid(props: Partial<ComponentProps<typeof WeekGrid>> = {}) {
  return render(
    <WeekGrid
      week="2026-W43"
      rows={rows}
      submitted={false}
      submittedAt={null}
      vabNotes={[]}
      clients={[{ id: 1, name: "Acme" }]}
      defaultClientId={1}
      {...props}
    />,
  );
}

describe("WeekGrid", () => {
  beforeEach(() => {
    saveDay.mockClear().mockImplementation(() => Promise.resolve());
    submitWeek.mockClear().mockImplementation(() => Promise.resolve());
    reopenWeek.mockClear().mockImplementation(() => Promise.resolve());
    applyWeekPreset.mockClear().mockImplementation(() => Promise.resolve());
    toastSuccess.mockClear();
    toastError.mockClear();
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

  it("saves and shows a spinner while the type change is saving", async () => {
    let resolveSave: () => void = () => {};
    saveDay.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveSave = resolve)));
    renderGrid();

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vacation" },
    });

    expect(saveDay).toHaveBeenCalledWith({
      date: "2026-10-20",
      type: "vacation",
      hours: "",
      note: "",
      clientId: "1",
    });
    expect(await screen.findByLabelText("Sparar")).toBeInTheDocument();

    resolveSave();
    await waitFor(() => expect(screen.queryByLabelText("Sparar")).not.toBeInTheDocument());
  });

  it("toasts an error when a day save fails", async () => {
    saveDay.mockRejectedValueOnce(new Error("nope"));
    renderGrid();

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vacation" },
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Kunde inte spara dagen"));
  });

  it("toasts after the week is submitted", async () => {
    renderGrid();

    fireEvent.click(screen.getByRole("button", { name: "Skicka in vecka" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Vecka inskickad"));
  });

  it("toasts after the week is reopened", async () => {
    renderGrid({ submitted: true, submittedAt: "2026-10-25T18:00:00.000Z" });

    fireEvent.click(screen.getByRole("button", { name: "Öppna igen" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Vecka öppnad"));
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
      clientId: "1",
    });
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("uses a fixed table layout with a column reserved for the note", () => {
    const { container } = renderGrid();

    const table = container.querySelector("table");
    expect(table).toHaveClass("table-fixed");

    // Six columns: Dag, Datum, Typ, Timmar, Barn, Status.
    expect(container.querySelectorAll("colgroup col")).toHaveLength(6);
    expect(container.querySelectorAll("thead th")).toHaveLength(6);

    // Every body row keeps all six cells, even when it is not a VAB row,
    // so the columns never shift when the note input appears or disappears.
    for (const bodyRow of container.querySelectorAll("tbody tr")) {
      expect(bodyRow.querySelectorAll("td")).toHaveLength(6);
    }
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
      clientId: "1",
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

  const twoClients = [
    { id: 1, name: "Acme" },
    { id: 2, name: "Globex" },
  ];

  it("hides the Kund column when there is only one client", () => {
    const { container } = renderGrid();

    expect(screen.queryByText("Kund")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Kund 2026-10-19")).not.toBeInTheDocument();
    // The six-column layout from #20 is unchanged when the column is hidden.
    expect(container.querySelectorAll("thead th")).toHaveLength(6);
    for (const bodyRow of container.querySelectorAll("tbody tr")) {
      expect(bodyRow.querySelectorAll("td")).toHaveLength(6);
    }
  });

  it("shows a client select on each work row when there are several clients", () => {
    const { container } = renderGrid({ clients: twoClients });

    expect(screen.getByText("Kund")).toBeInTheDocument();
    expect(screen.getByLabelText("Kund 2026-10-19")).toHaveValue("1");
    // Seven columns now: the Kund column slots in after Typ.
    expect(container.querySelectorAll("colgroup col")).toHaveLength(7);
    expect(container.querySelectorAll("thead th")).toHaveLength(7);
  });

  it("keeps the client select out of the tab order", () => {
    renderGrid({ clients: twoClients });

    expect(screen.getByLabelText("Kund 2026-10-19")).toHaveAttribute("tabindex", "-1");
  });

  it("hides the client select on non-work rows", () => {
    renderGrid({ clients: twoClients });

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vacation" },
    });

    expect(screen.queryByLabelText("Kund 2026-10-20")).not.toBeInTheDocument();
  });

  it("saves the chosen client when it changes", () => {
    renderGrid({ clients: twoClients });

    fireEvent.change(screen.getByLabelText("Kund 2026-10-20"), {
      target: { value: "2" },
    });

    expect(saveDay).toHaveBeenCalledWith({
      date: "2026-10-20",
      type: "work",
      hours: "",
      note: "",
      clientId: "2",
    });
  });

  it("shows a per-client breakdown under the total when several clients have hours", () => {
    const { container } = renderGrid({
      clients: twoClients,
      rows: [
        { date: "2026-10-19", type: "work", hours: 8, note: null, clientId: 1 },
        { date: "2026-10-20", type: "work", hours: 4, note: null, clientId: 2 },
      ],
    });

    // Scope to the footer: client names also appear as <option>s in the selects.
    const tfoot = within(container.querySelector("tfoot") as HTMLElement);
    expect(tfoot.getByText("12")).toBeInTheDocument();
    expect(tfoot.getByText("Acme")).toBeInTheDocument();
    expect(tfoot.getByText("Globex")).toBeInTheDocument();
    expect(tfoot.getByText("8")).toBeInTheDocument();
    expect(tfoot.getByText("4")).toBeInTheDocument();
  });

  it("omits the breakdown when only one client has hours", () => {
    const { container } = renderGrid({ clients: twoClients });

    // Both work rows bill the same client, so there is nothing to break down.
    const tfoot = within(container.querySelector("tfoot") as HTMLElement);
    expect(tfoot.queryByText("Acme")).not.toBeInTheDocument();
  });
});
