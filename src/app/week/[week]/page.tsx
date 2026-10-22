import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type DayEntry, dayEntries } from "@/db/schema";
import { getWeekReport } from "@/db/weekReports";
import { isSwedishHoliday } from "@/lib/holidays";
import {
  formatDate,
  formatWeek,
  nextWeek,
  parseWeek,
  prevWeek,
  weekDays,
} from "@/lib/week";
import { WeekGrid, type WeekGridRow } from "./week-grid";

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
  const dbRows = db
    .select()
    .from(dayEntries)
    .where(inArray(dayEntries.date, dates))
    .all();
  const entries = new Map<string, DayEntry>(dbRows.map((row) => [row.date, row]));

  const rows: WeekGridRow[] = dates.map((date, index) => {
    const entry = entries.get(date);
    if (entry) {
      return { date, type: entry.type, hours: entry.hours, note: entry.note };
    }
    // Pre-fill weekday red days as holiday with 0 hours. Not persisted until
    // the user saves; weekends stay empty.
    const isWeekday = index < 5;
    if (isWeekday && isSwedishHoliday(date)) {
      return { date, type: "holiday", hours: 0, note: null };
    }
    return { date, type: "work", hours: null, note: null };
  });

  const report = getWeekReport(db, week);

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

      <WeekGrid
        week={formatWeek(week)}
        rows={rows}
        submitted={report !== undefined}
        submittedAt={report?.submittedAt ?? null}
      />
    </main>
  );
}
