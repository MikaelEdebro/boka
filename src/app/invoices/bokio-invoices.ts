import { type BokioInvoice, listInvoices } from "@/bokio/client";

export type BokioInvoiceList = { ok: true; invoices: BokioInvoice[] } | { ok: false; error: string };

export async function loadBokioInvoiceList(): Promise<BokioInvoiceList> {
  try {
    return { ok: true, invoices: await listInvoices() };
  } catch (error) {
    console.error("loadBokioInvoiceList failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Okänt fel.",
    };
  }
}
