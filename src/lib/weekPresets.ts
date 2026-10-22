import type { DayInput } from "@/lib/dayEntry";
import { isSwedishHoliday } from "@/lib/holidays";

// Each preset keyed by its day type (except "clear", which empties the week).
// The non-clear keys double as the DayType a weekday gets.
export const WEEK_PRESET_LABELS = {
  work: "Jobbat hela veckan",
  vacation: "Semester hela veckan",
  vab: "VAB hela veckan",
  sick: "Sjuk hela veckan",
  clear: "Rensa veckan",
} as const;

export const WEEK_PRESETS = Object.keys(WEEK_PRESET_LABELS) as WeekPreset[];

export type WeekPreset = keyof typeof WEEK_PRESET_LABELS;

const WORK_HOURS = 8;

// An empty weekday in this app is a work day with no hours (parseDay turns it
// into a delete), so clearing a day means exactly that.
function cleared(date: string): DayInput {
  return { date, type: "work", hours: "" };
}

// Maps a preset to the desired entry for each of the week's seven dates
// (Monday first). Weekend days are always cleared; weekday red days keep their
// holiday type and get no hours, so a preset never overwrites a helgdag.
export function weekPresetEntries(dates: string[], preset: WeekPreset): DayInput[] {
  return dates.map((date, index) => {
    if (preset === "clear") return cleared(date);

    const isWeekend = index >= 5;
    if (isWeekend) return cleared(date);

    if (isSwedishHoliday(date)) return { date, type: "holiday", hours: 0 };

    if (preset === "work") return { date, type: "work", hours: WORK_HOURS };
    return { date, type: preset, hours: "" };
  });
}
