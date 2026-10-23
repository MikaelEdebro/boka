"use server";

import { revalidatePath } from "next/cache";
import { getCustomer } from "@/bokio/client";
import { getDb } from "@/db/client";
import {
  CLIENT_HAS_RECORDS_MESSAGE,
  ClientHasRecordsError,
  deleteClient,
  setDefaultClient,
  upsertClient,
} from "@/db/clients";
import type { ActionResult } from "@/lib/actionResult";
import { parseClient, parseClientForm } from "@/lib/clients";

export async function saveClient(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const values = parseClientForm({
      hourlyRate: formData.get("hourlyRate"),
      bokioCustomerId: formData.get("bokioCustomerId"),
      invoiceItemName: formData.get("invoiceItemName"),
    });
    // Verify the id exists in Bokio so a client is never saved unverified.
    // Kept here (not in the Zod schema) so unit tests of the schema stay offline.
    const customer = await getCustomer(values.bokioCustomerId);
    if (!customer) {
      return { ok: false, error: "Kund-ID finns inte i Bokio" };
    }
    const idValue = formData.get("id");
    const id = typeof idValue === "string" && idValue !== "" ? Number(idValue) : undefined;
    upsertClient(getDb(), { ...parseClient({ ...values, name: customer.name }), id });
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
    if (error instanceof ClientHasRecordsError) return { ok: false, error: error.message };
    console.error("removeClient failed:", error);
    return {
      ok: false,
      error: isSqliteConstraintError(error) ? CLIENT_HAS_RECORDS_MESSAGE : "Kunde inte ta bort kunden.",
    };
  }
}

function isSqliteConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("SQLITE_CONSTRAINT")
  );
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
