"use server";

import { listCustomers } from "@/bokio/client";
import { getSecretsStatus } from "@/lib/settings";

export type ConnectionTestResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function testBokioConnection(): Promise<ConnectionTestResult> {
  try {
    const secrets = getSecretsStatus();
    if (!secrets.bokioToken || !secrets.bokioCompanyId) {
      return { ok: false, error: "Bokio-nycklar saknas i .env." };
    }
    const customers = await listCustomers();
    return { ok: true, message: `Ansluten: ${customers.length} kunder hittades` };
  } catch (error) {
    console.error("testBokioConnection failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte ansluta till Bokio.",
    };
  }
}
