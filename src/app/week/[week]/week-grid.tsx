"use client";

import { Loader2 } from "lucide-react";
import {
  Fragment,
  useRef,
  useState,
  useTransition,
  type FocusEvent,
  type MouseEvent,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DAY_TYPES, type DayType } from "@/db/schema";
import { DAY_TYPE_LABELS, weekdayLabel } from "@/lib/labels";
import { hoursError, normalizeHours, type DayInput } from "@/lib/dayEntry";
import {
  WEEK_PRESETS,
  WEEK_PRESET_LABELS,
  weekPresetEntries,
  type WeekPreset,
} from "@/lib/weekPresets";
import { applyWeekPreset, saveDay } from "./actions";

type WorkState = { hours: string; note: string; clientId: string };
type RowState = WorkState & { type: DayType; work: WorkState | null };
type SaveStatus = "idle" | "saving";

// "VAB deltid" is a choice in the type dropdown, not a stored day type: it
// splits the date into a VAB row and a work row.
const VAB_PART_TIME = "vab_part";
const VAB_PART_TIME_LABEL = "VAB deltid";

export type ClientOption = { id: number; name: string };

export type WorkPart = { hours: number | null; note: string | null; clientId: number | null };

export type WeekGridRow = WorkPart & {
  date: string;
  type: DayType;
  // The work row of a part-time VAB day.
  work?: WorkPart | null;
  locked: boolean;
};

function toWorkState({ hours, note, clientId }: WorkPart): WorkState {
  return {
    hours: hours == null ? "" : String(hours),
    note: note ?? "",
    clientId: clientId == null ? "" : String(clientId),
  };
}

function toState(row: WeekGridRow): RowState {
  return { ...toWorkState(row), type: row.type, work: row.work ? toWorkState(row.work) : null };
}

function parsedHours(hours: string): number {
  const parsed = Number(normalizeHours(hours));
  return Number.isFinite(parsed) ? parsed : 0;
}

// Every [clientId, hours] the date bills: its own hours on a work day, the
// work row's hours on a part-time VAB day.
function billedHours(state: RowState): [string, number][] {
  if (state.type === "work") return [[state.clientId, parsedHours(state.hours)]];
  if (state.work) return [[state.work.clientId, parsedHours(state.work.hours)]];
  return [];
}

function inputToState(input: DayInput, defaultClientId: string): RowState {
  const { hours, clientId } = input;
  return {
    type: input.type,
    hours: hours === "" || hours == null ? "" : String(hours),
    note: "",
    clientId: clientId == null ? defaultClientId : String(clientId),
    work: null,
  };
}

function toDayInput(date: string, { type, hours, note, clientId, work }: RowState): DayInput {
  const day = { date, type, hours, note, clientId };
  return work ? { ...day, work } : day;
}

function workInputKey(date: string): string {
  return `${date}:work`;
}

// Browsers clear a focus-time selection on the mouseup that follows a click,
// so that first mouseup is swallowed; later clicks still place the caret.
function useSelectOnFocus() {
  const justFocused = useRef(false);
  return {
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      event.currentTarget.select();
      justFocused.current = true;
    },
    onMouseUp: (event: MouseEvent<HTMLInputElement>) => {
      if (!justFocused.current) return;
      justFocused.current = false;
      event.preventDefault();
    },
  };
}

export type WeekGridProps = {
  week: string;
  rows: WeekGridRow[];
  vabNotes: string[];
  clients: ClientOption[];
  defaultClientId: number | null;
  showWeekends?: boolean;
};

const VAB_NOTES_LIST_ID = "vab-notes";

export function WeekGrid({
  week,
  rows,
  vabNotes,
  clients,
  defaultClientId,
  showWeekends = false,
}: WeekGridProps) {
  const [states, setStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(rows.map((row) => [row.date, toState(row)])),
  );
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [hoursErrors, setHoursErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const hourInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const selectOnFocus = useSelectOnFocus();

  // The Kund column only earns its space once there is a choice to make.
  const showClients = clients.length > 1;
  const defaultClientValue = defaultClientId == null ? "" : String(defaultClientId);

  const allLocked = rows.every((row) => row.locked);
  const firstOpenDate = rows.find((row) => !row.locked)?.date;

  // Hours inputs in render order: each date's own, then its work row's.
  const hourInputKeys = rows.flatMap((row) =>
    states[row.date].work ? [row.date, workInputKey(row.date)] : [row.date],
  );

  function focusNextHours(key: string, current: HTMLInputElement) {
    const next = hourInputKeys
      .slice(hourInputKeys.indexOf(key) + 1)
      .map((nextKey) => hourInputs.current[nextKey])
      .find((input) => input && !input.disabled);
    // On the last input, blur to commit the value through the onBlur handler.
    if (next) next.focus();
    else current.blur();
  }

  const billed = rows.flatMap((row) => billedHours(states[row.date]));
  const total = billed.reduce((sum, [, hours]) => sum + hours, 0);

  const hoursByClient = new Map<string, number>();
  for (const [clientId, hours] of billed) {
    if (hours <= 0) continue;
    hoursByClient.set(clientId, (hoursByClient.get(clientId) ?? 0) + hours);
  }
  const clientNameById = new Map(clients.map((client) => [String(client.id), client.name]));
  const breakdown = [...hoursByClient.entries()];
  const showBreakdown = breakdown.length > 1;
  const labelColSpan = showClients ? 4 : 3;

  function applyPreset(preset: WeekPreset) {
    const lockedDates = new Set(rows.filter((row) => row.locked).map((row) => row.date));
    const dates = rows.map((row) => row.date);
    const entries = weekPresetEntries(dates, preset, defaultClientId, { showWeekends }).filter(
      (entry) => !lockedDates.has(entry.date),
    );
    setStates((prev) => {
      const next = { ...prev };
      for (const entry of entries) next[entry.date] = inputToState(entry, defaultClientValue);
      return next;
    });
    setStatuses({});
    setHoursErrors({});
    startTransition(async () => {
      try {
        await applyWeekPreset(week, preset, dates);
      } catch {
        toast.error("Kunde inte spara veckan");
      }
    });
  }

  function persist(date: string, next: RowState) {
    const errors = {
      [date]: hoursError(next.hours),
      [workInputKey(date)]: next.work ? hoursError(next.work.hours) : null,
    };
    setHoursErrors((prev) => {
      const nextErrors = { ...prev };
      for (const [key, error] of Object.entries(errors)) {
        if (error) nextErrors[key] = error;
        else delete nextErrors[key];
      }
      return nextErrors;
    });
    if (Object.values(errors).some(Boolean)) return;
    setStatuses((prev) => ({ ...prev, [date]: "saving" }));
    startTransition(async () => {
      try {
        await saveDay(toDayInput(date, next));
      } catch {
        toast.error("Kunde inte spara dagen");
      } finally {
        setStatuses((prev) => ({ ...prev, [date]: "idle" }));
      }
    });
  }

  function update(date: string, patch: Partial<RowState>) {
    const next = { ...states[date], ...patch };
    setStates((prev) => ({ ...prev, [date]: next }));
    persist(date, next);
  }

  function updateWork(date: string, patch: Partial<WorkState>) {
    const { work } = states[date];
    if (work) update(date, { work: { ...work, ...patch } });
  }

  // Work with no hours is not stored, so the Arbete row goes away with it.
  function commitWorkHours(date: string, hours: string) {
    if (hours.trim() === "") update(date, { work: null });
    else updateWork(date, { hours });
  }

  // Picking VAB deltid keeps any VAB hours and note, and moves a work day's
  // hours to the work row. Any other type, VAB included, collapses a split
  // date to one row.
  function changeType(date: string, value: string) {
    const state = states[date];
    if (value === VAB_PART_TIME) {
      if (state.work) return;
      const wasWork = state.type === "work";
      update(date, {
        type: "vab",
        hours: state.type === "vab" ? state.hours : "",
        note: state.type === "vab" ? state.note : "",
        work: {
          hours: wasWork ? state.hours : "",
          note: wasWork ? state.note : "",
          clientId: wasWork && state.clientId ? state.clientId : defaultClientValue,
        },
      });
      return;
    }
    update(date, { type: value as DayType, work: null });
  }

  // Local-only edit while typing; the value is persisted on blur via update().
  function editField(date: string, patch: Partial<RowState>) {
    setStates((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));
  }

  function editWorkField(date: string, patch: Partial<WorkState>) {
    setStates((prev) => {
      const { work } = prev[date];
      return work ? { ...prev, [date]: { ...prev[date], work: { ...work, ...patch } } } : prev;
    });
  }

  function renderClientSelect(
    label: string,
    value: string,
    locked: boolean,
    onChange: (clientId: string) => void,
  ) {
    return (
      <select
        aria-label={label}
        value={value}
        disabled={locked}
        tabIndex={-1}
        onChange={(event) => onChange(event.target.value)}
        className="w-36 rounded-md border bg-transparent px-2 py-1 disabled:opacity-50"
      >
        {clients.map((client) => (
          <option key={client.id} value={String(client.id)}>
            {client.name}
          </option>
        ))}
      </select>
    );
  }

  function renderHoursInput({
    inputKey,
    label,
    value,
    locked,
    onEdit,
    onCommit,
  }: {
    inputKey: string;
    label: string;
    value: string;
    locked: boolean;
    onEdit: (hours: string) => void;
    onCommit: (hours: string) => void;
  }) {
    const errorMessage = hoursErrors[inputKey];
    const errorId = `hours-error-${inputKey}`;
    return (
      <>
        <input
          ref={(node) => {
            hourInputs.current[inputKey] = node;
          }}
          aria-label={label}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*([.,][0-9]+)?"
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? errorId : undefined}
          autoFocus={inputKey === firstOpenDate}
          value={value}
          disabled={locked}
          onChange={(event) => onEdit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              focusNextHours(inputKey, event.currentTarget);
            }
          }}
          onBlur={(event) => onCommit(normalizeHours(event.target.value))}
          {...selectOnFocus}
          className="w-20 rounded-md border bg-transparent px-2 py-1 tabular-nums disabled:opacity-50 aria-invalid:border-destructive"
        />
        {errorMessage && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
            {errorMessage}
          </p>
        )}
      </>
    );
  }

  function renderNoteInput({
    label,
    value,
    isVab,
    locked,
    onEdit,
    onCommit,
  }: {
    label: string;
    value: string;
    isVab: boolean;
    locked: boolean;
    onEdit: (note: string) => void;
    onCommit: (note: string) => void;
  }) {
    return (
      <input
        aria-label={label}
        type="text"
        tabIndex={-1}
        placeholder={isVab ? "Barn" : "Kommentar"}
        list={isVab ? VAB_NOTES_LIST_ID : undefined}
        value={value}
        disabled={locked}
        onChange={(event) => onEdit(event.target.value)}
        onBlur={(event) => onCommit(event.target.value)}
        {...selectOnFocus}
        className="w-full rounded-md border bg-transparent px-2 py-1 disabled:opacity-50"
      />
    );
  }

  return (
    <>
      {!allLocked && (
        <div className="mt-6 flex flex-wrap gap-2">
          {WEEK_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={preset === "clear" ? "ghost" : "outline"}
              disabled={pending}
              onClick={() => applyPreset(preset)}
            >
              {WEEK_PRESET_LABELS[preset]}
            </Button>
          ))}
        </div>
      )}
      <datalist id={VAB_NOTES_LIST_ID}>
        {vabNotes.map((note) => (
          <option key={note} value={note} />
        ))}
      </datalist>
      <table className="mt-6 w-full table-fixed text-sm">
        <colgroup>
          <col className="w-24" />
          <col className="w-28" />
          <col className="w-40" />
          {showClients && <col className="w-40" />}
          <col className="w-24" />
          <col />
          <col className="w-20" />
        </colgroup>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">Dag</th>
            <th className="py-2 font-medium">Datum</th>
            <th className="py-2 font-medium">Typ</th>
            {showClients && <th className="py-2 font-medium">Kund</th>}
            <th className="py-2 font-medium">Timmar</th>
            <th className="py-2 font-medium">Kommentar</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const state = states[row.date];
            const status = statuses[row.date] ?? "idle";
            const isVab = state.type === "vab";
            return (
              <Fragment key={row.date}>
                <tr className={state.work ? undefined : "border-b"}>
                  <td className="py-2">{weekdayLabel(row.date)}</td>
                  <td className="py-2">{row.date}</td>
                  <td className="py-2">
                    <select
                      aria-label={`Typ ${row.date}`}
                      value={state.work ? VAB_PART_TIME : state.type}
                      disabled={row.locked}
                      tabIndex={-1}
                      onChange={(event) => changeType(row.date, event.target.value)}
                      className="rounded-md border bg-transparent px-2 py-1 disabled:opacity-50"
                    >
                      {DAY_TYPES.map((type) => (
                        <Fragment key={type}>
                          <option value={type}>{DAY_TYPE_LABELS[type]}</option>
                          {type === "vab" && (
                            <option value={VAB_PART_TIME}>{VAB_PART_TIME_LABEL}</option>
                          )}
                        </Fragment>
                      ))}
                    </select>
                  </td>
                  {showClients && (
                    <td className="py-2">
                      {state.type === "work" &&
                        renderClientSelect(`Kund ${row.date}`, state.clientId, row.locked, (clientId) =>
                          update(row.date, { clientId }),
                        )}
                    </td>
                  )}
                  <td className="py-2">
                    {renderHoursInput({
                      inputKey: row.date,
                      label: `Timmar ${row.date}`,
                      value: state.hours,
                      locked: row.locked,
                      onEdit: (hours) => editField(row.date, { hours }),
                      onCommit: (hours) => update(row.date, { hours }),
                    })}
                  </td>
                  <td className="py-2">
                    {renderNoteInput({
                      label: `Kommentar ${row.date}`,
                      value: state.note,
                      isVab,
                      locked: row.locked,
                      onEdit: (note) => editField(row.date, { note }),
                      onCommit: (note) => update(row.date, { note }),
                    })}
                  </td>
                  <td
                    className="py-2 whitespace-nowrap text-muted-foreground"
                    aria-live="polite"
                  >
                    {row.locked && <span className="text-xs text-muted-foreground">Fakturerad</span>}
                    {!row.locked && status === "saving" && (
                      <Loader2 className="size-4 animate-spin" aria-label="Sparar" />
                    )}
                  </td>
                </tr>
                {state.work && (
                  <tr className="border-b">
                    <td className="py-2" colSpan={2}></td>
                    <td className="py-2 pl-3">{DAY_TYPE_LABELS.work}</td>
                    {showClients && (
                      <td className="py-2">
                        {renderClientSelect(
                          `Kund arbete ${row.date}`,
                          state.work.clientId,
                          row.locked,
                          (clientId) => updateWork(row.date, { clientId }),
                        )}
                      </td>
                    )}
                    <td className="py-2">
                      {renderHoursInput({
                        inputKey: workInputKey(row.date),
                        label: `Timmar arbete ${row.date}`,
                        value: state.work.hours,
                        locked: row.locked,
                        onEdit: (hours) => editWorkField(row.date, { hours }),
                        onCommit: (hours) => commitWorkHours(row.date, hours),
                      })}
                    </td>
                    <td className="py-2">
                      {renderNoteInput({
                        label: `Kommentar arbete ${row.date}`,
                        value: state.work.note,
                        isVab: false,
                        locked: row.locked,
                        onEdit: (note) => editWorkField(row.date, { note }),
                        onCommit: (note) => updateWork(row.date, { note }),
                      })}
                    </td>
                    <td className="py-2"></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="py-2" colSpan={labelColSpan}>
              Summa arbetstimmar
            </td>
            <td className="py-2 tabular-nums">{total}</td>
            <td className="py-2" colSpan={2}></td>
          </tr>
          {showBreakdown &&
            breakdown.map(([clientId, hours]) => (
              <tr key={clientId} className="text-muted-foreground">
                <td className="py-1 pl-4" colSpan={labelColSpan}>
                  {clientNameById.get(clientId) ?? "Okänd kund"}
                </td>
                <td className="py-1 tabular-nums">{hours}</td>
                <td className="py-1" colSpan={2}></td>
              </tr>
            ))}
        </tfoot>
      </table>
    </>
  );
}
