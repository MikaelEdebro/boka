import { getISODay, parseISO } from "date-fns";
import type { DayType } from "@/db/schema";

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  work: "Arbete",
  vacation: "Semester",
  leave: "Ledig",
  vab: "VAB",
  sick: "Sjuk",
  parental: "Föräldraledig",
  holiday: "Helgdag",
};

export const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Mars",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Augusti",
  "September",
  "Oktober",
  "November",
  "December",
] as const;

export const WEEKDAY_LABELS = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
] as const;

export function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[getISODay(parseISO(date)) - 1];
}
