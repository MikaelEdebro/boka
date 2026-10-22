import { parseISO } from "date-fns";
import { isHoliday } from "swedish-holidays";

// A red day (röd dag) is an officially non-working public holiday. The
// swedish-holidays package also tracks "eves" such as Midsommarafton, Julafton
// and Trettondagsafton, which are ordinary working days (isPublicHoliday ===
// false), so we only treat a date as a holiday when its holiday entry is a
// public holiday. We intentionally use isHoliday() rather than the package's
// isPublicHoliday(), because the latter reports every Sunday as a public
// holiday; here a plain Sunday has no holiday entry and is not pre-filled.
export function isSwedishHoliday(date: string): boolean {
  const holiday = isHoliday(parseISO(date));
  return holiday?.isPublicHoliday ?? false;
}
