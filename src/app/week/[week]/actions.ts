"use server";

import { revalidatePath } from "next/cache";
import { getDb, type Db } from "@/db/client";
import { getDefaultClient } from "@/db/clients";
import { deleteDayEntry, upsertDayEntry } from "@/db/dayEntries";
import { isWeekSubmitted, reopenWeekReport, submitWeekReport } from "@/db/weekReports";
import { parseDay, type DayInput, type ParsedDay } from "@/lib/dayEntry";
import {
  formatDate,
  formatWeek,
  parseWeek,
  weekDays,
  weekForDate,
  type Week,
} from "@/lib/week";
import { weekPresetEntries, type WeekPreset } from "@/lib/weekPresets";

function writeDay(db: Db, parsed: ParsedDay): void {
  if (parsed.op === "delete") {
    deleteDayEntry(db, parsed.date);
  } else {
    upsertDayEntry(db, parsed);
  }
}

export async function saveDay(input: DayInput): Promise<void> {
  const parsed = parseDay(input);
  const db = getDb();

  const week = weekForDate(parsed.date);
  if (isWeekSubmitted(db, week)) {
    throw new Error("Veckan är inskickad och låst");
  }

  writeDay(db, parsed);

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
  const defaultClientId = getDefaultClient(db)?.id ?? null;
  const entries = weekPresetEntries(dates, preset, defaultClientId);

  const writeAll = db.$client.transaction(() => {
    for (const entry of entries) {
      writeDay(db, parseDay(entry));
    }
  });
  writeAll();

  revalidatePath(`/week/${formatWeek(week)}`);
}
