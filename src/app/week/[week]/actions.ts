"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { deleteDayEntry, upsertDayEntry } from "@/db/dayEntries";
import { parseDay, type DayInput } from "@/lib/dayEntry";
import { formatWeek, weekForDate } from "@/lib/week";

export async function saveDay(input: DayInput): Promise<void> {
  const parsed = parseDay(input);
  const db = getDb();

  if (parsed.op === "delete") {
    deleteDayEntry(db, parsed.date);
  } else {
    upsertDayEntry(db, parsed);
  }

  revalidatePath(`/week/${formatWeek(weekForDate(parsed.date))}`);
}
