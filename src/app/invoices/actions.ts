"use server";

import { revalidatePath } from "next/cache";
import { createInvoice, getInvoice } from "@/bokio/client";
import { getDb } from "@/db/client";
import { getClient } from "@/db/clients";
import {
  deleteInvoice,
  getWorkDays,
  insertInvoice,
  listInvoices,
  updateInvoiceStatus,
} from "@/db/invoices";
import { listWeekReports } from "@/db/weekReports";
import {
  aggregateMonth,
  invoicedKey,
  invoicedKeys,
  invoiceLineDescription,
  parseYearMonth,
} from "@/lib/invoicing";
import type { ActionResult } from "@/lib/actionResult";
import { getSecretsStatus } from "@/lib/settings";
import { formatWeek } from "@/lib/week";

export async function createInvoiceForMonth(
  yearMonth: string,
  clientId: number,
): Promise<ActionResult> {
  try {
    await createInvoiceOrThrow(yearMonth, clientId);
    revalidatePath("/invoices");
    return { ok: true };
  } catch (error) {
    console.error("createInvoiceForMonth failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Kunde inte skapa faktura." };
  }
}

export type RefreshInvoiceStatusesResult = ActionResult<{ removed: number }>;

export async function refreshInvoiceStatuses(): Promise<RefreshInvoiceStatusesResult> {
  try {
    const secrets = getSecretsStatus();
    if (!secrets.bokioToken || !secrets.bokioCompanyId) {
      return { ok: false, error: "Bokio-nycklar saknas i .env." };
    }

    const db = getDb();
    const checkedAt = new Date().toISOString();
    let removed = 0;
    for (const row of listInvoices(db)) {
      const invoice = await getInvoice(row.bokioInvoiceId);
      if (invoice === null) {
        deleteInvoice(db, row.id);
        removed++;
        continue;
      }
      updateInvoiceStatus(db, row.id, {
        bokioStatus: invoice.status,
        bokioInvoiceNumber: invoice.invoiceNumber,
        statusCheckedAt: checkedAt,
      });
    }

    revalidatePath("/invoices");
    return { ok: true, removed };
  } catch (error) {
    console.error("refreshInvoiceStatuses failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte uppdatera status.",
    };
  }
}

function invoiceableMonthOrThrow(yearMonth: string, clientId: number) {
  if (!parseYearMonth(yearMonth)) throw new Error(`Ogiltig månad: ${yearMonth}`);

  const db = getDb();
  const client = getClient(db, clientId);
  if (!client) {
    throw new Error("Kunden finns inte. Välj en kund under Kunder.");
  }

  const secrets = getSecretsStatus();
  if (!secrets.bokioToken || !secrets.bokioCompanyId) {
    throw new Error("Bokio-nycklar saknas i .env.");
  }

  const invoicedPairs = invoicedKeys(listInvoices(db));
  if (invoicedPairs.has(invoicedKey(yearMonth, clientId))) {
    throw new Error("Månaden är redan fakturerad för kunden.");
  }

  const submittedWeeks = new Set(
    listWeekReports(db).map((report) => formatWeek({ year: report.isoYear, week: report.isoWeek })),
  );
  const aggregation = aggregateMonth(
    yearMonth,
    clientId,
    getWorkDays(db),
    submittedWeeks,
    client.hourlyRate,
  );

  if (aggregation.hours === 0) {
    throw new Error("Inga arbetstimmar att fakturera för månaden.");
  }
  if (aggregation.unsubmittedWeeks.length > 0) {
    throw new Error(`Alla veckor är inte inskickade: ${aggregation.unsubmittedWeeks.join(", ")}`);
  }

  return { db, client, aggregation };
}

async function createInvoiceOrThrow(yearMonth: string, clientId: number): Promise<void> {
  const { db, client, aggregation } = invoiceableMonthOrThrow(yearMonth, clientId);

  const bokioInvoiceId = await createInvoice({
    customerId: client.bokioCustomerId,
    invoiceDate: aggregation.periodEnd,
    lines: [
      {
        description: invoiceLineDescription(
          client.invoiceItemName,
          aggregation.periodStart,
          aggregation.periodEnd,
        ),
        quantity: aggregation.hours,
        unitPrice: client.hourlyRate,
      },
    ],
  });

  insertInvoice(db, {
    bokioInvoiceId,
    periodStart: aggregation.periodStart,
    periodEnd: aggregation.periodEnd,
    hours: aggregation.hours,
    clientId,
  });
}

export type LinkInvoiceResult = ActionResult<{ invoiceNumber: string | null }>;

export async function linkInvoice(
  yearMonth: string,
  clientId: number,
  bokioInvoiceId: string,
): Promise<LinkInvoiceResult> {
  try {
    const invoiceNumber = await linkInvoiceOrThrow(yearMonth, clientId, bokioInvoiceId);
    revalidatePath("/invoices");
    return { ok: true, invoiceNumber };
  } catch (error) {
    console.error("linkInvoice failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Kunde inte koppla faktura." };
  }
}

async function linkInvoiceOrThrow(
  yearMonth: string,
  clientId: number,
  bokioInvoiceId: string,
): Promise<string | null> {
  const { db, client, aggregation } = invoiceableMonthOrThrow(yearMonth, clientId);

  if (listInvoices(db).some((row) => row.bokioInvoiceId === bokioInvoiceId)) {
    throw new Error("Bokio-fakturan är redan kopplad.");
  }

  const bokioInvoice = await getInvoice(bokioInvoiceId);
  if (!bokioInvoice) {
    throw new Error("Fakturan finns inte i Bokio.");
  }
  if (bokioInvoice.customerId !== client.bokioCustomerId) {
    throw new Error("Bokio-fakturan tillhör en annan kund.");
  }

  insertInvoice(db, {
    bokioInvoiceId,
    periodStart: aggregation.periodStart,
    periodEnd: aggregation.periodEnd,
    hours: aggregation.hours,
    clientId,
    bokioStatus: bokioInvoice.status,
    bokioInvoiceNumber: bokioInvoice.invoiceNumber,
    statusCheckedAt: new Date().toISOString(),
    linked: true,
  });
  return bokioInvoice.invoiceNumber;
}
