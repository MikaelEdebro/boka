"use server";

import { revalidatePath } from "next/cache";
import { createInvoice } from "@/bokio/client";
import { getDb } from "@/db/client";
import { getWorkDays, insertInvoice, listInvoices } from "@/db/invoices";
import { getSettings } from "@/db/settings";
import { listWeekReports } from "@/db/weekReports";
import { aggregateMonth, monthKey, parseYearMonth } from "@/lib/invoicing";
import { getSecretsStatus } from "@/lib/settings";
import { formatWeek } from "@/lib/week";

export async function createInvoiceForMonth(yearMonth: string): Promise<void> {
  if (!parseYearMonth(yearMonth)) throw new Error(`Ogiltig månad: ${yearMonth}`);

  const db = getDb();
  const settings = getSettings(db);
  if (settings.hourlyRate == null) {
    throw new Error("Timpris saknas i inställningarna.");
  }
  if (!settings.bokioCustomerId) {
    throw new Error("Bokio-kund saknas i inställningarna.");
  }

  const secrets = getSecretsStatus();
  if (!secrets.bokioToken || !secrets.bokioCompanyId) {
    throw new Error("Bokio-nycklar saknas i .env.");
  }

  const invoicedMonths = new Set(listInvoices(db).map((invoice) => monthKey(invoice.periodStart)));
  if (invoicedMonths.has(yearMonth)) {
    throw new Error("Månaden är redan fakturerad.");
  }

  const submittedWeeks = new Set(
    listWeekReports(db).map((report) => formatWeek({ year: report.isoYear, week: report.isoWeek })),
  );
  const aggregation = aggregateMonth(yearMonth, getWorkDays(db), submittedWeeks, settings.hourlyRate);

  if (aggregation.hours === 0) {
    throw new Error("Inga arbetstimmar att fakturera för månaden.");
  }
  if (aggregation.unsubmittedWeeks.length > 0) {
    throw new Error(`Alla veckor är inte inskickade: ${aggregation.unsubmittedWeeks.join(", ")}`);
  }

  const bokioInvoiceId = await createInvoice({
    customerId: settings.bokioCustomerId,
    invoiceDate: aggregation.periodEnd,
    lines: [
      {
        description: settings.invoiceItemName,
        quantity: aggregation.hours,
        unitPrice: settings.hourlyRate,
      },
    ],
  });

  insertInvoice(db, {
    bokioInvoiceId,
    periodStart: aggregation.periodStart,
    periodEnd: aggregation.periodEnd,
    hours: aggregation.hours,
  });

  revalidatePath("/invoices");
}
