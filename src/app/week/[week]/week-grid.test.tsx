import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveDay = vi.fn((..._args: unknown[]) => Promise.resolve());
const applyWeekPreset = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock("./actions", () => ({
  saveDay: (...args: unknown[]) => saveDay(...args),
  applyWeekPreset: (...args: unknown[]) => applyWeekPreset(...args),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

import { WeekGrid, type WeekGridRow } from "./week-grid";

const rows: WeekGridRow[] = [
  { date: "2026-10-19", type: "work", hours: 8, note: null, clientId: 1, locked: false },
  { date: "2026-10-20", type: "work", hours: null, note: null, clientId: 1, locked: false },
];

function renderGrid(props: Partial<ComponentProps<typeof WeekGrid>> = {}) {
  return render(
    <WeekGrid
      week="2026-W43"
      rows={rows}
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
    applyWeekPreset.mockClear().mockImplementation(() => Promise.resolve());
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it("fills the whole week with work hours from the preset pill", () => {
    renderGrid();

    fireEvent.click(screen.getByRole("button", { name: "Jobbat hela veckan" }));

    expect(applyWeekPreset).toHaveBeenCalledWith("2026-W43", "work", ["2026-10-19", "2026-10-20"]);
    // Both rows now show work 8h, so the total reflects it immediately.
    expect(screen.getByText("16")).toBeInTheDocument();
  });

  it("labels the rows by their date's weekday, not their position", () => {
    renderGrid({
      rows: ["2026-10-21", "2026-10-23", "2026-10-25"].map((date) => ({ ...rows[1], date })),
    });

    expect(screen.getAllByRole("row").slice(1, 4).map((row) => row.firstChild?.textContent)).toEqual([
      "Onsdag",
      "Fredag",
      "Söndag",
    ]);
  });

  it("shows Måndag–Fredag for a Monday–Friday week and Lördag, Söndag for seven rows", () => {
    const weekRows = (count: number) =>
      Array.from({ length: count }, (_, offset) => ({ ...rows[1], date: `2026-10-${19 + offset}` }));

    const { unmount } = renderGrid({ rows: weekRows(5) });
    for (const label of ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText("Lördag")).not.toBeInTheDocument();
    unmount();

    renderGrid({ rows: weekRows(7), showWeekends: true });
    expect(screen.getByText("Lördag")).toBeInTheDocument();
    expect(screen.getByText("Söndag")).toBeInTheDocument();
  });

  it("keeps weekend hours when a preset is applied with weekends shown", () => {
    renderGrid({
      rows: [rows[1], { ...rows[0], date: "2026-10-24", hours: 5 }],
      showWeekends: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Jobbat hela veckan" }));

    expect(screen.getByLabelText("Timmar 2026-10-20")).toHaveValue("8");
    expect(screen.getByLabelText("Timmar 2026-10-24")).toHaveValue("5");
    expect(screen.getByText("13")).toBeInTheDocument();
  });

  it("hides the preset pills when every day of the week is invoiced", () => {
    renderGrid({ rows: rows.map((row) => ({ ...row, locked: true })) });

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

  it("renders the hours as decimal text inputs without number spinners", () => {
    const { container } = renderGrid();

    expect(container.querySelector('input[type="number"]')).toBeNull();
    const input = screen.getByLabelText("Timmar 2026-10-19");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(input).toHaveAttribute("pattern", "[0-9]*([.,][0-9]+)?");
  });

  it("saves hours typed with a decimal comma as a dot decimal", () => {
    renderGrid();

    const input = screen.getByLabelText("Timmar 2026-10-20");
    fireEvent.change(input, { target: { value: "7,5" } });
    fireEvent.blur(input);

    expect(saveDay).toHaveBeenCalledWith({
      date: "2026-10-20",
      type: "work",
      hours: "7.5",
      note: "",
      clientId: "1",
    });
    expect(screen.getByText("15.5")).toBeInTheDocument();
  });

  it("shows invalid hours inline and does not save them", () => {
    renderGrid();

    const input = screen.getByLabelText("Timmar 2026-10-20");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);

    expect(saveDay).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Timmar måste vara ett tal");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the inline hours error once a valid value is saved", () => {
    renderGrid();

    const input = screen.getByLabelText("Timmar 2026-10-20");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.blur(input);

    expect(saveDay).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid", "true");
  });

  it("uses a fixed table layout with a column reserved for the note", () => {
    const { container } = renderGrid();

    const table = container.querySelector("table");
    expect(table).toHaveClass("table-fixed");

    // Six columns: Dag, Datum, Typ, Timmar, Kommentar, Status.
    expect(container.querySelectorAll("colgroup col")).toHaveLength(6);
    expect(container.querySelectorAll("thead th")).toHaveLength(6);

    // Every body row keeps all six cells so the columns never shift.
    for (const bodyRow of container.querySelectorAll("tbody tr")) {
      expect(bodyRow.querySelectorAll("td")).toHaveLength(6);
    }
  });

  it("shows a Kommentar column header", () => {
    renderGrid();

    expect(screen.getByRole("columnheader", { name: "Kommentar" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Barn" })).not.toBeInTheDocument();
  });

  it("shows a note input on a work row with the Kommentar placeholder and saves it on blur", () => {
    renderGrid();

    const note = screen.getByLabelText("Kommentar 2026-10-19");
    expect(note).toHaveAttribute("placeholder", "Kommentar");

    fireEvent.change(note, { target: { value: "Kundmöte" } });
    fireEvent.blur(note);

    expect(saveDay).toHaveBeenLastCalledWith({
      date: "2026-10-19",
      type: "work",
      hours: "8",
      note: "Kundmöte",
      clientId: "1",
    });
  });

  it("shows a note input on a leave row and saves it on blur", () => {
    renderGrid({
      rows: [
        { date: "2026-10-19", type: "leave", hours: null, note: null, clientId: null, locked: false },
      ],
    });

    const note = screen.getByLabelText("Kommentar 2026-10-19");
    expect(note).toHaveAttribute("placeholder", "Kommentar");

    fireEvent.change(note, { target: { value: "Förskolan stängd" } });
    fireEvent.blur(note);

    expect(saveDay).toHaveBeenLastCalledWith({
      date: "2026-10-19",
      type: "leave",
      hours: "",
      note: "Förskolan stängd",
      clientId: "",
    });
  });

  it("uses the Barn placeholder on VAB rows and saves the note on blur", () => {
    renderGrid();

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vab" },
    });

    const note = screen.getByLabelText("Kommentar 2026-10-20");
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
    fireEvent.change(screen.getByLabelText("Kommentar 2026-10-20"), {
      target: { value: "Otto" },
    });
    fireEvent.blur(screen.getByLabelText("Kommentar 2026-10-20"));

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "sick" },
    });
    expect(screen.getByLabelText("Kommentar 2026-10-20")).toHaveValue("Otto");

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vab" },
    });
    expect(screen.getByLabelText("Kommentar 2026-10-20")).toHaveValue("Otto");
  });

  it("offers previously used VAB notes as datalist options on VAB rows only", () => {
    renderGrid({ vabNotes: ["Otto", "Stina"] });

    expect(screen.getByLabelText("Kommentar 2026-10-19")).not.toHaveAttribute("list");

    fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), {
      target: { value: "vab" },
    });

    const note = screen.getByLabelText("Kommentar 2026-10-20");
    const listId = note.getAttribute("list");
    expect(listId).toBeTruthy();
    const datalist = document.getElementById(listId as string);
    expect(datalist).not.toBeNull();
    expect(datalist?.querySelectorAll("option")).toHaveLength(2);
  });

  it("disables the inputs of an invoiced day and labels it Fakturerad", () => {
    renderGrid({ rows: [{ ...rows[0], locked: true }, rows[1]] });

    expect(screen.getByLabelText("Typ 2026-10-19")).toBeDisabled();
    expect(screen.getByLabelText("Timmar 2026-10-19")).toBeDisabled();
    expect(screen.getByLabelText("Kommentar 2026-10-19")).toBeDisabled();
    const lockedRow = screen.getByLabelText("Timmar 2026-10-19").closest("tr") as HTMLElement;
    expect(within(lockedRow).getByText("Fakturerad")).toHaveClass("text-muted-foreground");

    expect(screen.getByLabelText("Timmar 2026-10-20")).toBeEnabled();
    const openRow = screen.getByLabelText("Timmar 2026-10-20").closest("tr") as HTMLElement;
    expect(within(openRow).queryByText("Fakturerad")).not.toBeInTheDocument();
  });

  it("disables the Kund select of an invoiced day", () => {
    renderGrid({
      rows: [{ ...rows[0], locked: true }, rows[1]],
      clients: [
        { id: 1, name: "Acme" },
        { id: 2, name: "Globex" },
      ],
    });

    expect(screen.getByLabelText("Kund 2026-10-19")).toBeDisabled();
    expect(screen.getByLabelText("Kund 2026-10-20")).toBeEnabled();
  });

  it("leaves invoiced days unchanged when a preset is applied", () => {
    renderGrid({ rows: [{ ...rows[0], locked: true }, rows[1]] });

    fireEvent.click(screen.getByRole("button", { name: "Semester hela veckan" }));

    expect(applyWeekPreset).toHaveBeenCalledWith("2026-W43", "vacation", [
      "2026-10-19",
      "2026-10-20",
    ]);
    expect(screen.getByLabelText("Typ 2026-10-19")).toHaveValue("work");
    expect(screen.getByLabelText("Timmar 2026-10-19")).toHaveValue("8");
    expect(screen.getByLabelText("Typ 2026-10-20")).toHaveValue("vacation");
  });

  it("autofocuses the first open day's hours when earlier days are invoiced", () => {
    renderGrid({ rows: [{ ...rows[0], locked: true }, rows[1]] });

    expect(screen.getByLabelText("Timmar 2026-10-20")).toHaveFocus();
  });

  it("commits the last open day on Enter when the following days are invoiced", () => {
    renderGrid({ rows: [rows[1], { ...rows[0], date: "2026-10-21", locked: true }] });

    const input = screen.getByLabelText("Timmar 2026-10-20");
    input.focus();
    fireEvent.change(input, { target: { value: "6" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).not.toHaveFocus();
  });

  it("does not show the week submit button any more", () => {
    renderGrid();

    expect(screen.queryByRole("button", { name: "Skicka in vecka" })).not.toBeInTheDocument();
  });

  it("moves Tab from hours straight to the next row's hours, skipping the type dropdown and the note", async () => {
    const user = userEvent.setup();
    renderGrid();

    expect(screen.getByLabelText("Kommentar 2026-10-19")).toBeInTheDocument();
    screen.getByLabelText("Timmar 2026-10-19").focus();

    await user.tab();
    expect(screen.getByLabelText("Timmar 2026-10-20")).toHaveFocus();
  });

  it("keeps the note input out of the tab order", () => {
    renderGrid();

    expect(screen.getByLabelText("Kommentar 2026-10-19")).toHaveAttribute("tabindex", "-1");
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

  it("selects the hours on Tab so typing replaces the value", async () => {
    const user = userEvent.setup();
    renderGrid({
      rows: [
        { date: "2026-10-19", type: "work", hours: null, note: null, clientId: 1, locked: false },
        { date: "2026-10-20", type: "work", hours: 8, note: null, clientId: 1, locked: false },
      ],
    });

    screen.getByLabelText("Timmar 2026-10-19").focus();
    await user.tab();
    await user.keyboard("6");

    expect(screen.getByLabelText("Timmar 2026-10-20")).toHaveValue("6");
  });

  it("selects the next hours on Enter so typing replaces the value", async () => {
    const user = userEvent.setup();
    renderGrid({
      rows: [
        { date: "2026-10-19", type: "work", hours: 8, note: null, clientId: 1, locked: false },
        { date: "2026-10-20", type: "work", hours: 8, note: null, clientId: 1, locked: false },
      ],
    });

    screen.getByLabelText("Timmar 2026-10-19").focus();
    await user.keyboard("{Enter}6");

    expect(screen.getByLabelText("Timmar 2026-10-20")).toHaveValue("6");
  });

  it("selects the hours on click so typing replaces the value", async () => {
    const user = userEvent.setup();
    renderGrid();

    const tuesday = screen.getByLabelText("Timmar 2026-10-20");
    fireEvent.change(tuesday, { target: { value: "8" } });
    await user.click(tuesday);
    await user.keyboard("6");

    expect(tuesday).toHaveValue("6");
  });

  it("selects the note on focus so typing replaces it", async () => {
    const user = userEvent.setup();
    renderGrid({
      rows: [
        { date: "2026-10-19", type: "work", hours: 8, note: null, clientId: 1, locked: false },
        { date: "2026-10-20", type: "vab", hours: null, note: "Stina", clientId: null, locked: false },
      ],
    });

    await user.click(screen.getByLabelText("Kommentar 2026-10-20"));
    await user.keyboard("Olle");

    expect(screen.getByLabelText("Kommentar 2026-10-20")).toHaveValue("Olle");
  });

  it("autofocuses Monday's hours input", () => {
    renderGrid();

    expect(screen.getByLabelText("Timmar 2026-10-19")).toHaveFocus();
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
        { date: "2026-10-19", type: "work", hours: 8, note: null, clientId: 1, locked: false },
        { date: "2026-10-20", type: "work", hours: 4, note: null, clientId: 2, locked: false },
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

  describe("VAB deltid", () => {
    const twoClients = [
      { id: 1, name: "Acme" },
      { id: 2, name: "Globex" },
    ];
    const partTimeRow: WeekGridRow = {
      date: "2026-10-20",
      type: "vab",
      hours: 5,
      note: "Joar",
      clientId: null,
      work: { hours: 3, note: null, clientId: 2 },
      locked: false,
    };

    it("offers VAB deltid in the type dropdown", () => {
      renderGrid();

      const options = within(screen.getByLabelText("Typ 2026-10-20")).getAllByRole("option");
      expect(options.map((option) => option.textContent)).toContain("VAB deltid");
    });

    it("splits the date into a VAB row and an Arbete row and saves both", () => {
      renderGrid({ clients: twoClients });

      fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), { target: { value: "vab_part" } });

      expect(screen.getByLabelText("Typ 2026-10-20")).toHaveValue("vab");
      expect(screen.getByLabelText("Timmar 2026-10-20")).toHaveValue("");
      expect(screen.getByLabelText("Kommentar 2026-10-20")).toHaveAttribute("list", "vab-notes");
      expect(screen.getByLabelText("Timmar arbete 2026-10-20")).toHaveValue("");
      expect(screen.getByLabelText("Kund arbete 2026-10-20")).toHaveValue("1");
      const workRow = screen.getByLabelText("Timmar arbete 2026-10-20").closest("tr") as HTMLElement;
      expect(within(workRow).getByText("Arbete")).toBeInTheDocument();
      expect(saveDay).toHaveBeenLastCalledWith({
        date: "2026-10-20",
        type: "vab",
        hours: "",
        note: "",
        clientId: "1",
        work: { hours: "", note: "", clientId: "1" },
      });
    });

    it("saves the VAB hours, note and work hours together and counts only the work hours", () => {
      renderGrid();
      fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), { target: { value: "vab_part" } });

      const vabHours = screen.getByLabelText("Timmar 2026-10-20");
      fireEvent.change(vabHours, { target: { value: "5" } });
      fireEvent.blur(vabHours);
      const note = screen.getByLabelText("Kommentar 2026-10-20");
      fireEvent.change(note, { target: { value: "Joar" } });
      fireEvent.blur(note);
      const workHours = screen.getByLabelText("Timmar arbete 2026-10-20");
      fireEvent.change(workHours, { target: { value: "3" } });
      fireEvent.blur(workHours);

      expect(saveDay).toHaveBeenLastCalledWith({
        date: "2026-10-20",
        type: "vab",
        hours: "5",
        note: "Joar",
        clientId: "1",
        work: { hours: "3", note: "", clientId: "1" },
      });
      // Monday's 8 h plus the 3 h of work; the 5 VAB hours are not work.
      expect(screen.getByText("11")).toBeInTheDocument();
    });

    it("moves a work day's hours into the Arbete row", () => {
      renderGrid();

      fireEvent.change(screen.getByLabelText("Typ 2026-10-19"), { target: { value: "vab_part" } });

      expect(screen.getByLabelText("Timmar 2026-10-19")).toHaveValue("");
      expect(screen.getByLabelText("Timmar arbete 2026-10-19")).toHaveValue("8");
    });

    it("renders a stored part-time VAB day as two rows with the client breakdown", () => {
      const { container } = renderGrid({ clients: twoClients, rows: [rows[0], partTimeRow] });

      expect(screen.getByLabelText("Typ 2026-10-20")).toHaveValue("vab");
      expect(screen.getByLabelText("Timmar 2026-10-20")).toHaveValue("5");
      expect(screen.getByLabelText("Kommentar 2026-10-20")).toHaveValue("Joar");
      expect(screen.getByLabelText("Timmar arbete 2026-10-20")).toHaveValue("3");
      expect(screen.getByLabelText("Kund arbete 2026-10-20")).toHaveValue("2");

      const tfoot = within(container.querySelector("tfoot") as HTMLElement);
      expect(tfoot.getByText("11")).toBeInTheDocument();
      expect(tfoot.getByText("Globex")).toBeInTheDocument();
      expect(tfoot.getByText("3")).toBeInTheDocument();
    });

    it("saves the chosen client of the Arbete row", () => {
      renderGrid({ clients: twoClients, rows: [partTimeRow] });

      fireEvent.change(screen.getByLabelText("Kund arbete 2026-10-20"), { target: { value: "1" } });

      expect(saveDay).toHaveBeenLastCalledWith(
        expect.objectContaining({ work: { hours: "3", note: "", clientId: "1" } }),
      );
    });

    it("collapses to one row when the VAB row changes to another type", () => {
      renderGrid({ rows: [partTimeRow] });

      fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), { target: { value: "sick" } });

      expect(screen.queryByLabelText("Timmar arbete 2026-10-20")).not.toBeInTheDocument();
      expect(saveDay).toHaveBeenLastCalledWith({
        date: "2026-10-20",
        type: "sick",
        hours: "5",
        note: "Joar",
        clientId: "",
      });
    });

    it.each(["vab", "vab_part"])("stays split when the VAB row is set to %s", (value) => {
      renderGrid({ rows: [partTimeRow] });

      fireEvent.change(screen.getByLabelText("Typ 2026-10-20"), { target: { value } });

      expect(screen.getByLabelText("Timmar arbete 2026-10-20")).toHaveValue("3");
    });

    it("shows an invalid work hours value inline without saving", () => {
      renderGrid({ rows: [partTimeRow] });

      const input = screen.getByLabelText("Timmar arbete 2026-10-20");
      fireEvent.change(input, { target: { value: "abc" } });
      fireEvent.blur(input);

      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toHaveTextContent("Timmar måste vara ett tal");
      expect(saveDay).not.toHaveBeenCalled();
    });

    it("moves Enter from the VAB hours to the work hours", () => {
      renderGrid({ rows: [partTimeRow, { ...rows[1], date: "2026-10-21" }] });

      const vabHours = screen.getByLabelText("Timmar 2026-10-20");
      vabHours.focus();
      fireEvent.keyDown(vabHours, { key: "Enter" });
      expect(screen.getByLabelText("Timmar arbete 2026-10-20")).toHaveFocus();

      fireEvent.keyDown(screen.getByLabelText("Timmar arbete 2026-10-20"), { key: "Enter" });
      expect(screen.getByLabelText("Timmar 2026-10-21")).toHaveFocus();
    });

    it("disables both rows when the month is invoiced", () => {
      renderGrid({ clients: twoClients, rows: [rows[0], { ...partTimeRow, locked: true }] });

      for (const label of [
        "Typ 2026-10-20",
        "Timmar 2026-10-20",
        "Kommentar 2026-10-20",
        "Timmar arbete 2026-10-20",
        "Kund arbete 2026-10-20",
        "Kommentar arbete 2026-10-20",
      ]) {
        expect(screen.getByLabelText(label)).toBeDisabled();
      }
    });

    it("collapses to the preset's single row when a preset is applied", () => {
      renderGrid({ rows: [rows[0], partTimeRow] });

      fireEvent.click(screen.getByRole("button", { name: "VAB hela veckan" }));

      expect(screen.queryByLabelText("Timmar arbete 2026-10-20")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Typ 2026-10-20")).toHaveValue("vab");
    });
  });
});
