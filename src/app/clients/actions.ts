"use server";

import { revalidatePath } from "next/cache";
import { type BokioCustomer, getCustomer, listCustomers } from "@/bokio/client";
import { getDb } from "@/db/client";
import { deleteClient, setDefaultClient, upsertClient } from "@/db/clients";
import type { ActionResult } from "@/lib/actionResult";
import { parseClient } from "@/lib/clients";

export type LoadCustomersResult =
  | { ok: true; customers: BokioCustomer[] }
  | { ok: false; error: string };

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
    // Verify the id exists in Bokio so a client is never saved unverified.
    // Kept here (not in the Zod schema) so unit tests of the schema stay offline.
    const customer = await getCustomer(values.bokioCustomerId);
    if (!customer) {
      return { ok: false, error: "Kund-ID finns inte i Bokio" };
    }
    const idValue = formData.get("id");
    const id = typeof idValue === "string" && idValue !== "" ? Number(idValue) : undefined;
    upsertClient(getDb(), { ...values, id });
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Kunde inte spara kunden." };
  }
}

export async function loadBokioCustomers(): Promise<LoadCustomersResult> {
  try {
    return { ok: true, customers: await listCustomers() };
  } catch (error) {
    console.error("loadBokioCustomers failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte hämta kunder från Bokio.",
    };
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
