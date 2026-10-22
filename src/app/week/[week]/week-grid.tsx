"use client";

import { useRef, useState, useTransition } from "react";
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

type RowState = { type: DayType; hours: string; note: string };
type SaveStatus = "idle" | "saving" | "saved" | "error";

export type WeekGridRow = {
  date: string;
  type: DayType;
  hours: number | null;
  note: string | null;
};

function toState(row: WeekGridRow): RowState {
  return {
    type: row.type,
    hours: row.hours == null ? "" : String(row.hours),
    note: row.note ?? "",
  };
}

function workHours(state: RowState): number {
  if (state.type !== "work") return 0;
  const parsed = Number(state.hours);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inputToState(input: DayInput): RowState {
  const { hours } = input;
  return {
    type: input.type,
    hours: hours === "" || hours == null ? "" : String(hours),
    note: "",
  };
}

export type WeekGridProps = {
  week: string;
  rows: WeekGridRow[];
  submitted: boolean;
  submittedAt: string | null;
};

export function WeekGrid({ week, rows, submitted, submittedAt }: WeekGridProps) {
  const [states, setStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(rows.map((row) => [row.date, toState(row)])),
  );
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [pending, startTransition] = useTransition();
  const hourInputs = useRef<(HTMLInputElement | null)[]>([]);

  function focusNextHours(index: number, current: HTMLInputElement) {
    const next = hourInputs.current[index + 1];
    // On the last input, blur to commit the value through the onBlur handler.
    if (next) next.focus();
    else current.blur();
  }

  const total = rows.reduce((sum, row) => sum + workHours(states[row.date]), 0);

  function applyPreset(preset: WeekPreset) {
    const entries = weekPresetEntries(
      rows.map((row) => row.date),
      preset,
    );
    setStates((prev) => {
      const next = { ...prev };
      for (const entry of entries) next[entry.date] = inputToState(entry);
      return next;
    });
    setStatuses({});
    startTransition(async () => {
      await applyWeekPreset(week, preset);
    });
  }

  function persist(date: string, next: RowState) {
    setStatuses((prev) => ({ ...prev, [date]: "saving" }));
    startTransition(async () => {
      try {
        await saveDay({ date, type: next.type, hours: next.hours, note: next.note });
        setStatuses((prev) => ({ ...prev, [date]: "saved" }));
      } catch {
        setStatuses((prev) => ({ ...prev, [date]: "error" }));
      }
    });
  }

  function update(date: string, patch: Partial<RowState>) {
    const next = { ...states[date], ...patch };
    setStates((prev) => ({ ...prev, [date]: next }));
    persist(date, next);
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
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">Dag</th>
            <th className="py-2 font-medium">Datum</th>
            <th className="py-2 font-medium">Typ</th>
            <th className="py-2 font-medium">Timmar</th>
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
                    onChange={(event) =>
                      setStates((prev) => ({
                        ...prev,
                        [row.date]: { ...prev[row.date], hours: event.target.value },
                      }))
                    }
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
                <td className="py-2 text-xs text-muted-foreground" aria-live="polite">
                  {status === "saving" && "Sparar…"}
                  {status === "saved" && "Sparat"}
                  {status === "error" && (
                    <span className="text-destructive">Fel</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="py-2" colSpan={3}>
              Summa arbetstimmar
            </td>
            <td className="py-2 tabular-nums">{total}</td>
            <td className="py-2"></td>
          </tr>
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

  function run(action: (week: string) => Promise<void>) {
    startTransition(async () => {
      await action(week);
    });
  }

  if (submitted) {
    return (
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Inskickad {formatSubmittedAt(submittedAt)}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(reopenWeek)}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
        >
          Öppna igen
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(submitWeek)}
        className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        Skicka in vecka
      </button>
    </div>
  );
}
