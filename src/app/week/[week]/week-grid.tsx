"use client";

import { useState, useTransition } from "react";
import { DAY_TYPES, type DayType } from "@/db/schema";
import { DAY_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/labels";
import { saveDay } from "./actions";

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

export function WeekGrid({ rows }: { rows: WeekGridRow[] }) {
  const [states, setStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(rows.map((row) => [row.date, toState(row)])),
  );
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [, startTransition] = useTransition();

  const total = rows.reduce((sum, row) => sum + workHours(states[row.date]), 0);

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
                  onChange={(event) =>
                    update(row.date, { type: event.target.value as DayType })
                  }
                  className="rounded-md border bg-transparent px-2 py-1"
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
                  aria-label={`Timmar ${row.date}`}
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={state.hours}
                  onChange={(event) =>
                    setStates((prev) => ({
                      ...prev,
                      [row.date]: { ...prev[row.date], hours: event.target.value },
                    }))
                  }
                  onBlur={(event) => update(row.date, { hours: event.target.value })}
                  className="w-20 rounded-md border bg-transparent px-2 py-1"
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
          <td className="py-2">{total}</td>
          <td className="py-2"></td>
        </tr>
      </tfoot>
    </table>
  );
}
