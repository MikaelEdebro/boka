import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type DayEntry, dayEntries } from "@/db/schema";
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

  const rows: WeekGridRow[] = dates.map((date) => {
    const entry = entries.get(date);
    return {
      date,
      type: entry?.type ?? "work",
      hours: entry?.hours ?? null,
      note: entry?.note ?? null,
    };
  });

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

      <WeekGrid rows={rows} />
    </main>
  );
}
