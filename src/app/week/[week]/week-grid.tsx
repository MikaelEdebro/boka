"use client";

import { Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DAY_TYPES, type DayType } from "@/db/schema";
import { DAY_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/labels";
import type { DayInput } from "@/lib/dayEntry";
import {
  WEEK_PRESETS,
  WEEK_PRESET_LABELS,
  weekPresetEntries,
  type WeekPreset,
} from "@/lib/weekPresets";
import { applyWeekPreset, reopenWeek, saveDay, submitWeek } from "./actions";

type RowState = { type: DayType; hours: string; note: string; clientId: string };
type SaveStatus = "idle" | "saving";

export type ClientOption = { id: number; name: string };

export type WeekGridRow = {
  date: string;
  type: DayType;
  hours: number | null;
  note: string | null;
  clientId: number | null;
};

function toState(row: WeekGridRow): RowState {
  return {
    type: row.type,
    hours: row.hours == null ? "" : String(row.hours),
    note: row.note ?? "",
    clientId: row.clientId == null ? "" : String(row.clientId),
  };
}

function workHours(state: RowState): number {
  if (state.type !== "work") return 0;
  const parsed = Number(state.hours);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inputToState(input: DayInput, defaultClientId: string): RowState {
  const { hours, clientId } = input;
  return {
    type: input.type,
    hours: hours === "" || hours == null ? "" : String(hours),
    note: "",
    clientId: clientId == null ? defaultClientId : String(clientId),
  };
}

export type WeekGridProps = {
  week: string;
  rows: WeekGridRow[];
  submitted: boolean;
  submittedAt: string | null;
  vabNotes: string[];
  clients: ClientOption[];
  defaultClientId: number | null;
};

const VAB_NOTES_LIST_ID = "vab-notes";

export function WeekGrid({
  week,
  rows,
  submitted,
  submittedAt,
  vabNotes,
  clients,
  defaultClientId,
}: WeekGridProps) {
  const [states, setStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(rows.map((row) => [row.date, toState(row)])),
  );
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [pending, startTransition] = useTransition();
  const hourInputs = useRef<(HTMLInputElement | null)[]>([]);

  // The Kund column only earns its space once there is a choice to make.
  const showClients = clients.length > 1;
  const defaultClientValue = defaultClientId == null ? "" : String(defaultClientId);

  function focusNextHours(index: number, current: HTMLInputElement) {
    const next = hourInputs.current[index + 1];
    // On the last input, blur to commit the value through the onBlur handler.
    if (next) next.focus();
    else current.blur();
  }

  const total = rows.reduce((sum, row) => sum + workHours(states[row.date]), 0);

  const hoursByClient = new Map<string, number>();
  for (const row of rows) {
    const state = states[row.date];
    const hours = workHours(state);
    if (hours <= 0) continue;
    hoursByClient.set(state.clientId, (hoursByClient.get(state.clientId) ?? 0) + hours);
  }
  const clientNameById = new Map(clients.map((client) => [String(client.id), client.name]));
  const breakdown = [...hoursByClient.entries()];
  const showBreakdown = breakdown.length > 1;
  const labelColSpan = showClients ? 4 : 3;

  function applyPreset(preset: WeekPreset) {
    const entries = weekPresetEntries(
      rows.map((row) => row.date),
      preset,
      defaultClientId,
    );
    setStates((prev) => {
      const next = { ...prev };
      for (const entry of entries) next[entry.date] = inputToState(entry, defaultClientValue);
      return next;
    });
    setStatuses({});
    startTransition(async () => {
      try {
        await applyWeekPreset(week, preset);
      } catch {
        toast.error("Kunde inte spara veckan");
      }
    });
  }

  function persist(date: string, next: RowState) {
    setStatuses((prev) => ({ ...prev, [date]: "saving" }));
    startTransition(async () => {
      try {
        await saveDay({
          date,
          type: next.type,
          hours: next.hours,
          note: next.note,
          clientId: next.clientId,
        });
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

  // Local-only edit while typing; the value is persisted on blur via update().
  function editField(date: string, patch: Partial<RowState>) {
    setStates((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));
  }

  return (
    <>
      {!submitted && (
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
          <col className="w-40" />
          <col className="w-20" />
        </colgroup>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">Dag</th>
            <th className="py-2 font-medium">Datum</th>
            <th className="py-2 font-medium">Typ</th>
            {showClients && <th className="py-2 font-medium">Kund</th>}
            <th className="py-2 font-medium">Timmar</th>
            <th className="py-2 font-medium">Barn</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const state = states[row.date];
            const status = statuses[row.date] ?? "idle";
            return (
              <tr key={row.date} className="border-b">
                <td className="py-2">{WEEKDAY_LABELS[index]}</td>
                <td className="py-2">{row.date}</td>
                <td className="py-2">
                  <select
                    aria-label={`Typ ${row.date}`}
                    value={state.type}
                    disabled={submitted}
                    tabIndex={-1}
                    onChange={(event) =>
                      update(row.date, { type: event.target.value as DayType })
                    }
                    className="rounded-md border bg-transparent px-2 py-1 disabled:opacity-50"
                  >
                    {DAY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DAY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </td>
                {showClients && (
                  <td className="py-2">
                    {state.type === "work" && (
                      <select
                        aria-label={`Kund ${row.date}`}
                        value={state.clientId}
                        disabled={submitted}
                        tabIndex={-1}
                        onChange={(event) =>
                          update(row.date, { clientId: event.target.value })
                        }
                        className="w-36 rounded-md border bg-transparent px-2 py-1 disabled:opacity-50"
                      >
                        {clients.map((client) => (
                          <option key={client.id} value={String(client.id)}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                )}
                <td className="py-2">
                  <input
                    ref={(node) => {
                      hourInputs.current[index] = node;
                    }}
                    aria-label={`Timmar ${row.date}`}
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    autoFocus={index === 0 && !submitted}
                    value={state.hours}
                    disabled={submitted}
                    onChange={(event) => editField(row.date, { hours: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        focusNextHours(index, event.currentTarget);
                      }
                    }}
                    onBlur={(event) => update(row.date, { hours: event.target.value })}
                    className="w-20 rounded-md border bg-transparent px-2 py-1 tabular-nums disabled:opacity-50"
                  />
                </td>
                <td className="py-2">
                  {state.type === "vab" && (
                    <input
                      aria-label={`Barn ${row.date}`}
                      type="text"
                      placeholder="Barn"
                      list={VAB_NOTES_LIST_ID}
                      value={state.note}
                      disabled={submitted}
                      onChange={(event) => editField(row.date, { note: event.target.value })}
                      onBlur={(event) => update(row.date, { note: event.target.value })}
                      className="w-32 rounded-md border bg-transparent px-2 py-1 disabled:opacity-50"
                    />
                  )}
                </td>
                <td
                  className="py-2 whitespace-nowrap text-muted-foreground"
                  aria-live="polite"
                >
                  {status === "saving" && (
                    <Loader2 className="size-4 animate-spin" aria-label="Sparar" />
                  )}
                </td>
              </tr>
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
      <WeekSubmit week={week} submitted={submitted} submittedAt={submittedAt} />
    </>
  );
}

function formatSubmittedAt(submittedAt: string | null): string {
  return submittedAt ? submittedAt.slice(0, 10) : "";
}

function WeekSubmit({
  week,
  submitted,
  submittedAt,
}: {
  week: string;
  submitted: boolean;
  submittedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: (week: string) => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action(week);
        toast.success(successMessage);
      } catch {
        toast.error("Något gick fel");
      }
    });
  }

  if (submitted) {
    return (
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Inskickad {formatSubmittedAt(submittedAt)}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(reopenWeek, "Vecka öppnad")}
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Öppna igen
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex justify-end">
      <Button type="button" disabled={pending} onClick={() => run(submitWeek, "Vecka inskickad")}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Skicka in vecka
      </Button>
    </div>
  );
}
