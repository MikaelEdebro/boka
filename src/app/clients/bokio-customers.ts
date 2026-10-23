import { type BokioCustomer, listCustomers } from "@/bokio/client";

export type BokioCustomerList =
  | { ok: true; customers: BokioCustomer[] }
  | { ok: false; error: string };

export async function loadBokioCustomerList(): Promise<BokioCustomerList> {
  try {
    return { ok: true, customers: await listCustomers() };
  } catch (error) {
    console.error("loadBokioCustomerList failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Okänt fel.",
    };
  }
}
