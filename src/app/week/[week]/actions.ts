"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { getDefaultClient, listClients } from "@/db/clients";
import { replaceDayEntries } from "@/db/dayEntries";
import { listInvoices } from "@/db/invoices";
import { parseDay, type DayInput } from "@/lib/dayEntry";
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

export async function saveDay(input: DayInput): Promise<void> {
  const parsed = parseDay(input);
  const db = getDb();

  if (isLocked(invoicedMonths(listInvoices(db)), parsed.date)) {
    throw new Error(INVOICED_MONTH_ERROR);
  }

  replaceDayEntries(db, parsed.date, parsed.entries);

  const week = weekForDate(parsed.date);
  revalidatePath(`/week/${formatWeek(week)}`);
}

function requireWeek(weekParam: string): Week {
  const week = parseWeek(weekParam);
  if (!week) throw new Error(`Ogiltig vecka: ${weekParam}`);
  return week;
}

// Only the dates the grid rendered are touched, so a hidden weekend day keeps
// whatever it holds.
export async function applyWeekPreset(
  weekParam: string,
  preset: WeekPreset,
  renderedDates: string[],
): Promise<void> {
  const week = requireWeek(weekParam);
  const db = getDb();
  const locked = invoicedMonths(listInvoices(db));

  const dates = weekDays(week)
    .map(formatDate)
    .filter((date) => renderedDates.includes(date));
  const defaultClientId = getDefaultClient(db)?.id ?? null;
  const showWeekends = listClients(db).some((client) => client.showWeekends);
  const entries = weekPresetEntries(dates, preset, defaultClientId, { showWeekends }).filter(
    (entry) => !isLocked(locked, entry.date),
  );

  const writeAll = db.$client.transaction(() => {
    for (const entry of entries) {
      const { date, entries } = parseDay(entry);
      replaceDayEntries(db, date, entries);
    }
  });
  writeAll();

  revalidatePath(`/week/${formatWeek(week)}`);
}
