import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DAY_TYPES, type DayEntry, dayEntries } from "@/db/schema";
import { DAY_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/labels";
import {
  formatDate,
  formatWeek,
  nextWeek,
  parseWeek,
  prevWeek,
  weekDays,
} from "@/lib/week";

export default async function WeekPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week: weekParam } = await params;
  const week = parseWeek(weekParam);
  if (!week) notFound();

  const dates = weekDays(week).map(formatDate);

  const db = getDb();
  const rows = db
    .select()
    .from(dayEntries)
    .where(inArray(dayEntries.date, dates))
    .all();
  const entries = new Map<string, DayEntry>(rows.map((row) => [row.date, row]));

  const totalWorkHours = rows
    .filter((row) => row.type === "work")
    .reduce((sum, row) => sum + (row.hours ?? 0), 0);

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <Link
          href={`/week/${formatWeek(prevWeek(week))}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Föregående
        </Link>
        <h1 className="text-xl font-semibold">
          Vecka {week.week}, {week.year}
        </h1>
        <Link
          href={`/week/${formatWeek(nextWeek(week))}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Nästa →
        </Link>
      </header>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">Dag</th>
            <th className="py-2 font-medium">Datum</th>
            <th className="py-2 font-medium">Typ</th>
            <th className="py-2 font-medium">Timmar</th>
          </tr>
        </thead>
        <tbody>
          {dates.map((date, index) => {
            const entry = entries.get(date);
            return (
              <tr key={date} className="border-b">
                <td className="py-2">{WEEKDAY_LABELS[index]}</td>
                <td className="py-2">{date}</td>
                <td className="py-2">
                  <select
                    aria-label={`Typ ${date}`}
                    defaultValue={entry?.type ?? "work"}
                    disabled
                    className="rounded-md border bg-transparent px-2 py-1"
                  >
                    {DAY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DAY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <input
                    aria-label={`Timmar ${date}`}
                    type="number"
                    defaultValue={entry?.hours ?? ""}
                    disabled
                    className="w-20 rounded-md border bg-transparent px-2 py-1"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="py-2" colSpan={3}>
              Summa arbetstimmar
            </td>
            <td className="py-2">{totalWorkHours}</td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}
