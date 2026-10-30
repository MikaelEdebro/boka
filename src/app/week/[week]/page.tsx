import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { listClients } from "@/db/clients";
import { getVabNotes } from "@/db/dayEntries";
import { type DayEntry, dayEntries } from "@/db/schema";
import { listInvoices } from "@/db/invoices";
import { isSwedishHoliday } from "@/lib/holidays";
import { invoicedMonths, monthKey } from "@/lib/invoicing";
import {
  currentWeek,
  formatDate,
  formatWeek,
  isWeekend,
  nextWeek,
  parseWeek,
  prevWeek,
  visibleWeekDates,
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

  const today = currentWeek();
  const isCurrentWeek = today.year === week.year && today.week === week.week;

  const weekDates = weekDays(week).map(formatDate);

  const db = getDb();
  const dbRows = db
    .select()
    .from(dayEntries)
    .where(inArray(dayEntries.date, weekDates))
    .all();
  const entriesByDate = new Map<string, DayEntry[]>();
  for (const row of dbRows) {
    entriesByDate.set(row.date, [...(entriesByDate.get(row.date) ?? []), row]);
  }

  const clients = listClients(db);
  const defaultClientId = clients.find((client) => client.isDefault)?.id ?? null;
  const showWeekends = clients.some((client) => client.showWeekends);
  const dates = visibleWeekDates(weekDates, showWeekends, new Set(entriesByDate.keys()));

  const invoiced = invoicedMonths(listInvoices(db));

  function rowValues(date: string): Omit<WeekGridRow, "locked"> {
    const dayRows = entriesByDate.get(date) ?? [];
    const vab = dayRows.find((entry) => entry.type === "vab");
    const work = dayRows.find((entry) => entry.type === "work");
    // A vab row next to a work row is a part-time VAB day ("VAB deltid").
    const entry = vab ?? dayRows[0];
    if (entry) {
      return {
        date,
        type: entry.type,
        hours: entry.hours,
        note: entry.note,
        clientId: entry.clientId,
        work: vab && work ? { hours: work.hours, note: work.note, clientId: work.clientId } : null,
      };
    }
    // Pre-fill weekday red days as holiday with 0 hours. Not persisted until
    // the user saves; weekends stay empty.
    if (!isWeekend(date) && isSwedishHoliday(date)) {
      return { date, type: "holiday", hours: 0, note: null, clientId: null };
    }
    // New work rows pre-select the default client so the common case is one
    // click of hours and done.
    return { date, type: "work", hours: null, note: null, clientId: defaultClientId };
  }

  const rows: WeekGridRow[] = dates.map((date) => ({
    ...rowValues(date),
    locked: invoiced.has(monthKey(date)),
  }));

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
          {isCurrentWeek ? (
            <Badge variant="secondary">Aktuell vecka</Badge>
          ) : (
            <Link href="/week" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Gå till aktuell vecka
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
        vabNotes={vabNotes}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        defaultClientId={defaultClientId}
        showWeekends={showWeekends}
      />
    </>
  );
}
