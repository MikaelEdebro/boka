import Link from "next/link";
import { getDb } from "@/db/client";
import { getDefaultClient } from "@/db/clients";
import { getWorkDays, listInvoices } from "@/db/invoices";
import { listWeekReports } from "@/db/weekReports";
import {
  invoiceLineDescription,
  monthKey,
  uninvoicedMonths,
  type MonthAggregation,
} from "@/lib/invoicing";
import { getSecretsStatus } from "@/lib/settings";
import { formatWeek } from "@/lib/week";
import { CreateInvoiceButton } from "./create-invoice-button";

const currency = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0,
});

export default function InvoicesPage() {
  const db = getDb();
  const client = getDefaultClient(db);
  const secrets = getSecretsStatus();

  const submittedWeeks = new Set(
    listWeekReports(db).map((report) => formatWeek({ year: report.isoYear, week: report.isoWeek })),
  );
  const invoices = listInvoices(db);
  const invoicedMonths = new Set(invoices.map((invoice) => monthKey(invoice.periodStart)));
  const months = uninvoicedMonths(
    getWorkDays(db),
    submittedWeeks,
    client?.hourlyRate ?? null,
    invoicedMonths,
  );

  const clientReady = client != null;
  const envReady = secrets.bokioToken && secrets.bokioCompanyId;

  function blockedReason(month: MonthAggregation): string | null {
    if (!clientReady) return "Lägg till en standardkund under Kunder.";
    if (!envReady) return "Bokio-nycklar saknas i .env.";
    if (month.unsubmittedWeeks.length > 0) {
      return `Veckor ej inskickade: ${month.unsubmittedWeeks.join(", ")}`;
    }
    return null;
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Fakturor</h1>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Att fakturera</h2>
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga månader att fakturera.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {months.map((month) => {
              const reason = blockedReason(month);
              return (
                <li
                  key={month.yearMonth}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <p className="font-medium">{month.yearMonth}</p>
                    <p className="text-sm text-muted-foreground">
                      {month.hours} h
                      {month.amount != null ? ` · ${currency.format(month.amount)}` : ""}
                    </p>
                    {client && (
                      <p className="text-sm text-muted-foreground">
                        {invoiceLineDescription(
                          client.invoiceItemName,
                          month.periodStart,
                          month.periodEnd,
                        )}
                      </p>
                    )}
                    {reason && <p className="mt-1 text-sm text-destructive">{reason}</p>}
                  </div>
                  <CreateInvoiceButton yearMonth={month.yearMonth} disabled={reason !== null} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Skapade fakturor</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga fakturor skapade ännu.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{monthKey(invoice.periodStart)}</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.hours} h · {invoice.periodStart}–{invoice.periodEnd}
                  </p>
                </div>
                <span className="font-mono text-sm text-muted-foreground">
                  {invoice.bokioInvoiceId}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          Inställningar
        </Link>
      </p>
    </>
  );
}
