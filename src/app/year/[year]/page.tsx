import { Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { listClients } from "@/db/clients";
import { getYearEntries } from "@/db/dayEntries";
import { listInvoices } from "@/db/invoices";
import { DAY_TYPE_LABELS, MONTH_LABELS } from "@/lib/labels";
import { invoicedMonths, summarizeYear, vabDaysByMonth } from "@/lib/summary";
import { cn } from "@/lib/utils";
import { currentWeek } from "@/lib/week";

const YEAR_RE = /^\d{4}$/;

const DAY_TYPE_COLUMNS = ["vacation", "leave", "vab", "sick", "parental", "holiday"] as const;

export const instant = false;

export default async function YearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearParam } = await params;
  if (!YEAR_RE.test(yearParam)) notFound();
  const year = Number(yearParam);

  await connection();
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : null;
  const isCurrentYear = currentWeek().year === year;

  const db = getDb();
  const entries = getYearEntries(db, year);
  const summary = summarizeYear(year, entries);
  const vabMonths = vabDaysByMonth(year, entries);
  const clientNamesById = new Map(listClients(db).map((client) => [client.id, client.name]));
  const invoiced = invoicedMonths(
    year,
    listInvoices(db).map((invoice) => ({
      periodStart: invoice.periodStart,
      hours: invoice.hours,
      clientName: clientNamesById.get(invoice.clientId) ?? "Okänd kund",
    })),
  );

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <Link
          href={`/year/${year - 1}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {year - 1}
        </Link>
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-semibold">År {year}</h1>
          {!isCurrentYear && (
            <Link href="/year" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Aktuellt år
            </Link>
          )}
        </div>
        <Link
          href={`/year/${year + 1}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {year + 1} →
        </Link>
      </header>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Månad</th>
            <th className="py-2 pr-4 text-right font-medium">Arbetstimmar</th>
            <th className="py-2 pr-4 text-center font-medium">Fakturerad</th>
            {DAY_TYPE_COLUMNS.map((key) => (
              <th key={key} className="py-2 pr-4 text-right font-medium">
                {DAY_TYPE_LABELS[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.months.map((month) => {
            const invoiceClients = invoiced.get(month.month);
            const isCurrent = month.month === currentMonth;
            return (
              <tr
                key={month.month}
                className={cn("border-b border-border", isCurrent && "bg-highlight")}
              >
                <td className={cn("py-2 pr-4", isCurrent && "font-medium text-highlight-foreground")}>
                  {MONTH_LABELS[month.month - 1]}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{month.workHours}</td>
                <td className="py-2 pr-4 text-center">
                  {invoiceClients?.map((invoice) => (
                    <span
                      key={invoice.clientName}
                      title={`${invoice.clientName}: ${invoice.hours} h fakturerat ${invoice.periodStart}`}
                    >
                      <Check
                        className="inline size-4 text-success"
                        strokeWidth={2.5}
                        aria-label={`Fakturerad: ${invoice.clientName}`}
                      />
                    </span>
                  ))}
                </td>
                {DAY_TYPE_COLUMNS.map((key) => (
                  <td key={key} className="py-2 pr-4 text-right tabular-nums">
                    {month[key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td className="py-2 pr-4">Totalt</td>
            <td className="py-2 pr-4 text-right tabular-nums">{summary.totals.workHours}</td>
            <td className="py-2 pr-4" />
            {DAY_TYPE_COLUMNS.map((key) => (
              <td key={key} className="py-2 pr-4 text-right tabular-nums">
                {summary.totals[key]}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>

      {vabMonths.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">VAB-dagar</h2>
          <ul aria-label="VAB-dagar" className="space-y-4 text-sm">
            {vabMonths.map((month) => (
              <li key={month.month}>
                <h3 className="mb-1 font-medium text-muted-foreground">
                  {MONTH_LABELS[month.month - 1]}
                </h3>
                <ul className="space-y-1">
                  {month.days.map((day) => (
                    <li key={day.date} className="flex gap-4">
                      <span className="tabular-nums">{day.date}</span>
                      <span>{day.note ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
