import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { inArray } from "drizzle-orm";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { listClients } from "@/db/clients";
import { getVabNotes } from "@/db/dayEntries";
import { type DayEntry, dayEntries } from "@/db/schema";
import { getWeekReport } from "@/db/weekReports";
import { isSwedishHoliday } from "@/lib/holidays";
import {
  currentWeek,
  formatDate,
  formatWeek,
  nextWeek,
  parseWeek,
  prevWeek,
  weekDays,
} from "@/lib/week";
import { WeekGrid, type WeekGridRow } from "./week-grid";

export const instant = false;

export default async function WeekPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week: weekParam } = await params;
  const week = parseWeek(weekParam);
  if (!week) notFound();

  await connection();
  const today = currentWeek();
  const isCurrentWeek = today.year === week.year && today.week === week.week;

  const dates = weekDays(week).map(formatDate);

  const db = getDb();
  const dbRows = db
    .select()
    .from(dayEntries)
    .where(inArray(dayEntries.date, dates))
    .all();
  const entries = new Map<string, DayEntry>(dbRows.map((row) => [row.date, row]));

  const clients = listClients(db);
  const defaultClientId = clients.find((client) => client.isDefault)?.id ?? null;

  const rows: WeekGridRow[] = dates.map((date, index) => {
    const entry = entries.get(date);
    if (entry) {
      return {
        date,
        type: entry.type,
        hours: entry.hours,
        note: entry.note,
        clientId: entry.clientId,
      };
    }
    // Pre-fill weekday red days as holiday with 0 hours. Not persisted until
    // the user saves; weekends stay empty.
    const isWeekday = index < 5;
    if (isWeekday && isSwedishHoliday(date)) {
      return { date, type: "holiday", hours: 0, note: null, clientId: null };
    }
    // New work rows pre-select the default client so the common case is one
    // click of hours and done.
    return { date, type: "work", hours: null, note: null, clientId: defaultClientId };
  });

  const report = getWeekReport(db, week);
  const vabNotes = getVabNotes(db);

  return (
    <>
      <header className="flex items-center justify-between">
        <Link
          href={`/week/${formatWeek(prevWeek(week))}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Föregående
        </Link>
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-xl font-semibold">
            Vecka {week.week},{" "}
            <Link href={`/year/${week.year}`} className="hover:underline">
              {week.year}
            </Link>
          </h1>
          {!isCurrentWeek && (
            <Link href="/week" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Aktuell vecka
            </Link>
          )}
        </div>
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
        vabNotes={vabNotes}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        defaultClientId={defaultClientId}
      />
    </>
  );
}
