import { format, parseISO } from "date-fns";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { StatusBadge } from "@/components/status-badge";
import { getDb } from "@/db/client";
import { listClients } from "@/db/clients";
import { getWorkDays, listInvoices } from "@/db/invoices";
import type { Client, Invoice } from "@/db/schema";
import { listWeekReports } from "@/db/weekReports";
import {
  invoicedKey,
  invoicedKeys,
  invoiceLineDescription,
  monthKey,
  uninvoicedMonths,
  type MonthAggregation,
} from "@/lib/invoicing";
import {
  compareHours,
  findBokioInvoiceForPeriod,
  WEAK_MATCH_WARNING,
} from "@/lib/invoiceMatching";
import { getSecretsStatus } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { formatWeek } from "@/lib/week";
import { CreateInvoiceButton } from "./create-invoice-button";
import { refreshInvoiceStatuses } from "./actions";
import { type BokioInvoiceList, loadBokioInvoiceList } from "./bokio-invoices";
import { LinkInvoiceButton } from "./link-invoice-button";
import { RefreshStatusButton } from "./refresh-status-button";

const currency = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0,
});

const ONE_HOUR_MS = 60 * 60 * 1000;

function statusesAreStale(invoices: Invoice[], now: number): boolean {
  if (invoices.length === 0) return false;
  return invoices.some(
    (invoice) =>
      invoice.statusCheckedAt === null ||
      now - new Date(invoice.statusCheckedAt).getTime() > ONE_HOUR_MS,
  );
}

function BokioInvoiceSuggestion({
  month,
  client,
  bokioInvoices,
  linkedBokioInvoiceIds,
  disabled,
}: {
  month: MonthAggregation;
  client: Client;
  bokioInvoices: BokioInvoiceList;
  linkedBokioInvoiceIds: ReadonlySet<string>;
  disabled: boolean;
}) {
  if (!bokioInvoices.ok) return null;
  const match = findBokioInvoiceForPeriod(bokioInvoices.invoices, {
    clientBokioCustomerId: client.bokioCustomerId,
    periodStart: month.periodStart,
    periodEnd: month.periodEnd,
    linkedBokioInvoiceIds,
  });
  if (!match) return null;

  const hours = compareHours(match.invoice, month.hours);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <StatusBadge status={match.invoice.status} />
        <LinkInvoiceButton
          yearMonth={month.yearMonth}
          clientId={month.clientId}
          bokioInvoiceId={match.invoice.id}
          invoiceNumber={match.invoice.invoiceNumber}
          hours={hours}
          disabled={disabled}
        />
      </div>
      <p
        className={cn(
          "flex items-center gap-1 text-xs",
          hours.hoursMatch
            ? "text-green-700 dark:text-green-400"
            : "text-amber-700 dark:text-amber-400",
        )}
      >
        {!hours.hoursMatch && <AlertTriangle className="size-3" aria-hidden />}
        <span>
          {hours.bokioHours} h i Bokio · {hours.appHours} h i Boka
        </span>
      </p>
      {match.strength === "weak" && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{WEAK_MATCH_WARNING}</p>
      )}
    </div>
  );
}

export default async function InvoicesPage() {
  await connection();

  const db = getDb();
  const secrets = getSecretsStatus();
  const envReady = Boolean(secrets.bokioToken && secrets.bokioCompanyId);

  // Best-effort auto-refresh: a Bokio failure must not break the page, it just
  // keeps the last known status (the action logs/toasts per #26).
  if (envReady && statusesAreStale(listInvoices(db), Date.now())) {
    await refreshInvoiceStatuses();
  }

  const clients = listClients(db);
  const clientsById = new Map(clients.map((client) => [client.id, client]));

  const submittedWeeks = new Set(
    listWeekReports(db).map((report) => formatWeek({ year: report.isoYear, week: report.isoWeek })),
  );
  const invoices = listInvoices(db);
  const months = uninvoicedMonths(getWorkDays(db), submittedWeeks, clients, invoicedKeys(invoices));
  const linkedBokioInvoiceIds = new Set(invoices.map((invoice) => invoice.bokioInvoiceId));
  const bokioInvoices: BokioInvoiceList =
    envReady && months.length > 0
      ? await loadBokioInvoiceList()
      : { ok: true, invoices: [] };

  function blockedReason(month: MonthAggregation): string | null {
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
        {!bokioInvoices.ok && (
          <p className="mb-3 text-xs text-muted-foreground">
            Kunde inte hämta fakturor från Bokio, inga kopplingsförslag visas.
          </p>
        )}
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Lägg till en kund under Kunder.</p>
        ) : months.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga månader att fakturera.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {months.map((month) => {
              const reason = blockedReason(month);
              const client = clientsById.get(month.clientId);
              return (
                <li
                  key={invoicedKey(month.yearMonth, month.clientId)}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <p className="font-medium">
                      {month.yearMonth} · {client?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {month.hours} h · {currency.format(month.amount)}
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
                  <div className="flex flex-col items-end gap-2">
                    <CreateInvoiceButton
                      yearMonth={month.yearMonth}
                      clientId={month.clientId}
                      disabled={reason !== null}
                    />
                    {client && (
                      <BokioInvoiceSuggestion
                        month={month}
                        client={client}
                        bokioInvoices={bokioInvoices}
                        linkedBokioInvoiceIds={linkedBokioInvoiceIds}
                        disabled={reason !== null}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 border-t border-border pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Fakturor i Bokio</h2>
          {invoices.length > 0 && envReady && <RefreshStatusButton />}
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga fakturor skapade ännu.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">
                    {monthKey(invoice.periodStart)} · {clientsById.get(invoice.clientId)?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.hours} h · {invoice.periodStart}–{invoice.periodEnd}
                  </p>
                  {invoice.statusCheckedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Kontrollerad {format(parseISO(invoice.statusCheckedAt), "yyyy-MM-dd HH:mm")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    {invoice.linked && (
                      <span className="text-xs text-muted-foreground">Kopplad</span>
                    )}
                    <StatusBadge status={invoice.bokioStatus} />
                  </div>
                  {invoice.bokioInvoiceNumber && (
                    <span className="text-sm text-muted-foreground">
                      Fakturanr {invoice.bokioInvoiceNumber}
                    </span>
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    {invoice.bokioInvoiceId}
                  </span>
                </div>
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
