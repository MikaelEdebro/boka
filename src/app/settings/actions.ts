"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { upsertSettings } from "@/db/settings";
import type { ActionResult } from "@/lib/actionResult";
import { parseSettings } from "@/lib/settings";

export async function saveSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const values = parseSettings({
      hourlyRate: formData.get("hourlyRate"),
      bokioCustomerId: formData.get("bokioCustomerId"),
      invoiceItemName: formData.get("invoiceItemName"),
    });
    upsertSettings(getDb(), values);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Kunde inte spara." };
  }
}
