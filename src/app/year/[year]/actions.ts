"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { setVabReported } from "@/db/dayEntries";
import type { ActionResult } from "@/lib/actionResult";
import { DATE_RE } from "@/lib/dayEntry";

// Reporting to Försäkringskassan is unrelated to invoicing, so locked months can toggle too.
export async function setVabDayReported(date: string, reported: boolean): Promise<ActionResult> {
  if (!DATE_RE.test(date)) return { ok: false, error: "Ogiltigt datum." };
  if (!setVabReported(getDb(), date, reported)) {
    return { ok: false, error: `Ingen VAB-dag ${date}.` };
  }
  revalidatePath(`/year/${date.slice(0, 4)}`);
  return { ok: true };
}
