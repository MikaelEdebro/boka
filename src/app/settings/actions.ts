"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { upsertSettings } from "@/db/settings";
import { parseSettings } from "@/lib/settings";

export async function saveSettings(formData: FormData): Promise<void> {
  const values = parseSettings({
    hourlyRate: formData.get("hourlyRate"),
    bokioCustomerId: formData.get("bokioCustomerId"),
    invoiceItemName: formData.get("invoiceItemName"),
  });
  upsertSettings(getDb(), values);
  revalidatePath("/settings");
}
