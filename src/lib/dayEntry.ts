import { z } from "zod";
import { DAY_TYPES, type DayType } from "@/db/schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined || value === null ? null : value;

const hoursField = z.preprocess(
  emptyToNull,
  z.coerce
    .number()
    .min(0, "Timmar måste vara mellan 0 och 24")
    .max(24, "Timmar måste vara mellan 0 och 24")
    .refine((hours) => Number.isInteger(hours * 2), "Timmar anges i halvtimmar")
    .nullable(),
);

const noteField = z.preprocess(emptyToNull, z.string().trim().nullable());

export const dayInputSchema = z.object({
  date: z.string().regex(DATE_RE, "Ogiltigt datum"),
  type: z.enum(DAY_TYPES),
  hours: hoursField,
  note: noteField.optional(),
});

export type DayInput = z.input<typeof dayInputSchema>;

export type ParsedDay =
  | { op: "delete"; date: string }
  | { op: "upsert"; date: string; type: DayType; hours: number | null; note: string | null };

export function parseDay(input: unknown): ParsedDay {
  const { date, type, hours, note } = dayInputSchema.parse(input);
  // A work day with no hours is the empty default state: remove the row.
  if (type === "work" && hours == null) {
    return { op: "delete", date };
  }
  return { op: "upsert", date, type, hours, note: note ?? null };
}
