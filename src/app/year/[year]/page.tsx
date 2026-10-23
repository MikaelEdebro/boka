import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getYearEntries } from "@/db/dayEntries";
import { DAY_TYPE_LABELS, MONTH_LABELS } from "@/lib/labels";
import { summarizeYear } from "@/lib/summary";

const YEAR_RE = /^\d{4}$/;

const DAY_TYPE_COLUMNS = ["vacation", "vab", "sick", "parental", "holiday"] as const;

export const instant = false;

export default async function YearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearParam } = await params;
  if (!YEAR_RE.test(yearParam)) notFound();
  const year = Number(yearParam);

  const summary = summarizeYear(year, getYearEntries(getDb(), year));

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <Link
          href={`/year/${year - 1}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {year - 1}
        </Link>
        <h1 className="text-2xl font-semibold">År {year}</h1>
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
            {DAY_TYPE_COLUMNS.map((key) => (
              <th key={key} className="py-2 pr-4 text-right font-medium">
                {DAY_TYPE_LABELS[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.months.map((month) => (
            <tr key={month.month} className="border-b border-border">
              <td className="py-2 pr-4">{MONTH_LABELS[month.month - 1]}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{month.workHours}</td>
              {DAY_TYPE_COLUMNS.map((key) => (
                <td key={key} className="py-2 pr-4 text-right tabular-nums">
                  {month[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-medium">
            <td className="py-2 pr-4">Totalt</td>
            <td className="py-2 pr-4 text-right tabular-nums">{summary.totals.workHours}</td>
            {DAY_TYPE_COLUMNS.map((key) => (
              <td key={key} className="py-2 pr-4 text-right tabular-nums">
                {summary.totals[key]}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </>
  );
}
