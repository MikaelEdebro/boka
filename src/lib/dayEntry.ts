import { z } from "zod";
import type { DayEntryValues } from "@/db/dayEntries";
import { DAY_TYPES, type DayType } from "@/db/schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined || value === null ? null : value;

export function normalizeHours(hours: string): string {
  return hours.trim().replace(",", ".");
}

const hoursField = z.preprocess(
  (value) => emptyToNull(typeof value === "string" ? normalizeHours(value) : value),
  z.coerce
    .number({ error: "Timmar måste vara ett tal" })
    .min(0, "Timmar måste vara mellan 0 och 24")
    .max(24, "Timmar måste vara mellan 0 och 24")
    .refine((hours) => Number.isInteger(hours * 2), "Timmar anges i halvtimmar")
    .nullable(),
);

export function hoursError(hours: string): string | null {
  const result = hoursField.safeParse(hours);
  return result.success ? null : result.error.issues[0].message;
}

const noteField = z.preprocess(emptyToNull, z.string().trim().nullable());

const clientIdField = z.preprocess(
  emptyToNull,
  z.coerce.number().int().positive().nullable(),
);

const workPartSchema = z.object({
  hours: hoursField,
  note: noteField.optional(),
  clientId: clientIdField.optional(),
});

export const dayInputSchema = z.object({
  date: z.string().regex(DATE_RE, "Ogiltigt datum"),
  type: z.enum(DAY_TYPES),
  hours: hoursField,
  note: noteField.optional(),
  clientId: clientIdField.optional(),
  // Part-time VAB ("VAB deltid"): the work done on the rest of a VAB day.
  work: workPartSchema.optional(),
});

export type DayInput = z.input<typeof dayInputSchema>;

// Every row the date should hold; an empty list clears the date.
export type ParsedDay = { date: string; entries: DayEntryValues[] };

type EntryFields = {
  type: DayType;
  hours: number | null;
  note?: string | null;
  clientId?: number | null;
};

function toEntry(
  date: string,
  { type, hours, note, clientId }: EntryFields,
): DayEntryValues | null {
  // A work day with no hours is the empty default state: no row.
  if (type === "work" && hours == null) return null;
  if (type === "work" && clientId == null) {
    throw new Error("Kund krävs för arbetsdagar");
  }
  // Hours belong to a client only on work days; other types never carry one.
  return {
    date,
    type,
    hours,
    note: note ?? null,
    clientId: type === "work" ? clientId ?? null : null,
  };
}

export function parseDay(input: unknown): ParsedDay {
  const { date, work, ...day } = dayInputSchema.parse(input);
  if (work && day.type !== "vab") {
    throw new Error("Endast VAB kan kombineras med arbete");
  }
  const entries = [toEntry(date, day), work ? toEntry(date, { ...work, type: "work" }) : null];
  return { date, entries: entries.filter((entry) => entry !== null) };
}
