import {
  addDays,
  addWeeks,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
} from "date-fns";

export type Week = { year: number; week: number };

const WEEK_PARAM = /^(\d{4})-W(\d{2})$/;

export function parseWeek(param: string): Week | null {
  const match = WEEK_PARAM.exec(param);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;

  const candidate = { year, week };
  // Reject weeks that don't exist in the given year (e.g. W53 of a 52-week year):
  // the computed Monday would roll into an adjacent ISO year/week.
  const monday = isoWeekMonday(candidate);
  if (getISOWeekYear(monday) !== year || getISOWeek(monday) !== week) return null;

  return candidate;
}

export function formatWeek(week: Week): string {
  return `${week.year}-W${String(week.week).padStart(2, "0")}`;
}

function isoWeekMonday(week: Week): Date {
  // Jan 4th is always part of ISO week 1 of its ISO year.
  const firstWeekMonday = startOfISOWeek(new Date(week.year, 0, 4));
  return addWeeks(firstWeekMonday, week.week - 1);
}

export function weekDays(week: Week): Date[] {
  const monday = isoWeekMonday(week);
  return Array.from({ length: 7 }, (_, offset) => addDays(monday, offset));
}

export function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function shiftWeek(week: Week, delta: number): Week {
  const monday = addWeeks(isoWeekMonday(week), delta);
  return { year: getISOWeekYear(monday), week: getISOWeek(monday) };
}

export function prevWeek(week: Week): Week {
  return shiftWeek(week, -1);
}

export function nextWeek(week: Week): Week {
  return shiftWeek(week, 1);
}

export function currentWeek(): Week {
  const now = new Date();
  return { year: getISOWeekYear(now), week: getISOWeek(now) };
}
