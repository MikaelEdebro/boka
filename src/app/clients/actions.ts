"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { deleteClient, setDefaultClient, upsertClient } from "@/db/clients";
import type { ActionResult } from "@/lib/actionResult";
import { parseClient } from "@/lib/clients";

export async function saveClient(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const values = parseClient({
      name: formData.get("name"),
      hourlyRate: formData.get("hourlyRate"),
      bokioCustomerId: formData.get("bokioCustomerId"),
      invoiceItemName: formData.get("invoiceItemName"),
    });
    const idValue = formData.get("id");
    const id = typeof idValue === "string" && idValue !== "" ? Number(idValue) : undefined;
    upsertClient(getDb(), { ...values, id });
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Kunde inte spara kunden." };
  }
}

export async function removeClient(id: number): Promise<ActionResult> {
  try {
    deleteClient(getDb(), id);
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Kunde inte ta bort kunden." };
  }
}

export async function makeDefaultClient(id: number): Promise<ActionResult> {
  try {
    setDefaultClient(getDb(), id);
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Kunde inte sätta standard." };
  }
}
