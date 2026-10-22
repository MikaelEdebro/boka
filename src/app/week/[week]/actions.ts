"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { deleteDayEntry, upsertDayEntry } from "@/db/dayEntries";
import { isWeekSubmitted, reopenWeekReport, submitWeekReport } from "@/db/weekReports";
import { parseDay, type DayInput } from "@/lib/dayEntry";
import {
  formatDate,
  formatWeek,
  parseWeek,
  weekDays,
  weekForDate,
  type Week,
} from "@/lib/week";
import { weekPresetEntries, type WeekPreset } from "@/lib/weekPresets";

export async function saveDay(input: DayInput): Promise<void> {
  const parsed = parseDay(input);
  const db = getDb();

  const week = weekForDate(parsed.date);
  if (isWeekSubmitted(db, week)) {
    throw new Error("Veckan är inskickad och låst");
  }

  if (parsed.op === "delete") {
    deleteDayEntry(db, parsed.date);
  } else {
    upsertDayEntry(db, parsed);
  }

  revalidatePath(`/week/${formatWeek(week)}`);
}

function requireWeek(weekParam: string): Week {
  const week = parseWeek(weekParam);
  if (!week) throw new Error(`Ogiltig vecka: ${weekParam}`);
  return week;
}

export async function submitWeek(weekParam: string): Promise<void> {
  const week = requireWeek(weekParam);
  submitWeekReport(getDb(), week);
  revalidatePath(`/week/${formatWeek(week)}`);
}

export async function reopenWeek(weekParam: string): Promise<void> {
  const week = requireWeek(weekParam);
  reopenWeekReport(getDb(), week);
  revalidatePath(`/week/${formatWeek(week)}`);
}

export async function applyWeekPreset(
  weekParam: string,
  preset: WeekPreset,
): Promise<void> {
  const week = requireWeek(weekParam);
  const db = getDb();
  if (isWeekSubmitted(db, week)) {
    throw new Error("Veckan är inskickad och låst");
  }

  const dates = weekDays(week).map(formatDate);
  const entries = weekPresetEntries(dates, preset);

  const writeAll = db.$client.transaction(() => {
    for (const entry of entries) {
      const parsed = parseDay(entry);
      if (parsed.op === "delete") {
        deleteDayEntry(db, parsed.date);
      } else {
        upsertDayEntry(db, parsed);
      }
    }
  });
  writeAll();

  revalidatePath(`/week/${formatWeek(week)}`);
}
