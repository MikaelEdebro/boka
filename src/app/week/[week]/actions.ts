"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { deleteDayEntry, upsertDayEntry } from "@/db/dayEntries";
import { isWeekSubmitted, reopenWeekReport, submitWeekReport } from "@/db/weekReports";
import { parseDay, type DayInput } from "@/lib/dayEntry";
import { formatWeek, parseWeek, weekForDate, type Week } from "@/lib/week";

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
