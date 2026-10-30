import type { DayInput } from "@/lib/dayEntry";
import { isSwedishHoliday } from "@/lib/holidays";
import { isWeekend } from "@/lib/week";

// Each preset keyed by its day type (except "clear", which empties the week).
// The non-clear keys double as the DayType a weekday gets.
export const WEEK_PRESET_LABELS = {
  work: "Jobbat hela veckan",
  vacation: "Semester hela veckan",
  leave: "Ledig hela veckan",
  vab: "VAB hela veckan",
  sick: "Sjuk hela veckan",
  clear: "Rensa veckan",
} as const;

export const WEEK_PRESETS = Object.keys(WEEK_PRESET_LABELS) as WeekPreset[];

export type WeekPreset = keyof typeof WEEK_PRESET_LABELS;

const WORK_HOURS = 8;

// An empty weekday in this app is a work day with no hours (parseDay gives it
// no rows, so every row of the date is removed), so clearing a day means exactly that.
function cleared(date: string): DayInput {
  return { date, type: "work", hours: "" };
}

// Maps a preset to the desired entry for each of the given dates. A preset
// describes a standard working week: weekend days are cleared when weekends
// are hidden and left out (untouched) when they are shown. Weekday red days
// keep their holiday type and get no hours, so a preset never overwrites a
// helgdag. The "work" preset bills its hours to the default client.
export function weekPresetEntries(
  dates: string[],
  preset: WeekPreset,
  defaultClientId: number | null = null,
  { showWeekends = false }: { showWeekends?: boolean } = {},
): DayInput[] {
  const presetDates = showWeekends ? dates.filter((date) => !isWeekend(date)) : dates;
  return presetDates.map((date) => {
    if (preset === "clear") return cleared(date);

    if (isWeekend(date)) return cleared(date);

    if (isSwedishHoliday(date)) return { date, type: "holiday", hours: 0 };

    if (preset === "work") {
      return { date, type: "work", hours: WORK_HOURS, clientId: defaultClientId };
    }
    return { date, type: preset, hours: "" };
  });
}
