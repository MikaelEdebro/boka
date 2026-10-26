"use server";

import { revalidatePath } from "next/cache";
import { getDb, type Db } from "@/db/client";
import { getDefaultClient } from "@/db/clients";
import { deleteDayEntry, upsertDayEntry } from "@/db/dayEntries";
import { listInvoices } from "@/db/invoices";
import { parseDay, type DayInput, type ParsedDay } from "@/lib/dayEntry";
import { INVOICED_MONTH_ERROR, invoicedMonths, monthKey } from "@/lib/invoicing";
import {
  formatDate,
  formatWeek,
  parseWeek,
  weekDays,
  weekForDate,
  type Week,
} from "@/lib/week";
import { weekPresetEntries, type WeekPreset } from "@/lib/weekPresets";

function isLocked(locked: ReadonlySet<string>, date: string): boolean {
  return locked.has(monthKey(date));
}

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

  if (isLocked(invoicedMonths(listInvoices(db)), parsed.date)) {
    throw new Error(INVOICED_MONTH_ERROR);
  }

  writeDay(db, parsed);

  const week = weekForDate(parsed.date);
  revalidatePath(`/week/${formatWeek(week)}`);
}

function requireWeek(weekParam: string): Week {
  const week = parseWeek(weekParam);
  if (!week) throw new Error(`Ogiltig vecka: ${weekParam}`);
  return week;
}

export async function applyWeekPreset(
  weekParam: string,
  preset: WeekPreset,
): Promise<void> {
  const week = requireWeek(weekParam);
  const db = getDb();
  const locked = invoicedMonths(listInvoices(db));

  const dates = weekDays(week).map(formatDate);
  const defaultClientId = getDefaultClient(db)?.id ?? null;
  const entries = weekPresetEntries(dates, preset, defaultClientId).filter(
    (entry) => !isLocked(locked, entry.date),
  );

  const writeAll = db.$client.transaction(() => {
    for (const entry of entries) {
      writeDay(db, parseDay(entry));
    }
  });
  writeAll();

  revalidatePath(`/week/${formatWeek(week)}`);
}
