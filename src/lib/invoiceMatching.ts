import { addDays, format, parseISO } from "date-fns";
import type { BokioInvoice } from "@/bokio/client";

export type InvoiceMatchStrength = "strong" | "weak";

export type InvoiceMatch = { invoice: BokioInvoice; strength: InvoiceMatchStrength };

export type InvoiceMatchQuery = {
  clientBokioCustomerId: string;
  periodStart: string;
  periodEnd: string;
  linkedBokioInvoiceIds?: ReadonlySet<string>;
};

export const WEAK_MATCH_WARNING = "Datum matchar men fakturaraden saknar period";

const WEAK_MATCH_WINDOW_DAYS = 45;
const CREDIT_STATUSES = new Set(["credit", "credited"]);
const DASH = "[-–—]";
const DATE = "\\d{4}-\\d{2}-\\d{2}";
const ANY_PERIOD_RE = new RegExp(`\\(\\s*${DATE}\\s*${DASH}\\s*${DATE}\\s*\\)`);

function periodRe(periodStart: string, periodEnd: string): RegExp {
  return new RegExp(`\\(\\s*${periodStart}\\s*${DASH}\\s*${periodEnd}\\s*\\)`);
}

function hasLineMatching(invoice: BokioInvoice, re: RegExp): boolean {
  return invoice.lineItems.some((line) => re.test(line.description));
}

export function findBokioInvoiceForPeriod(
  invoices: BokioInvoice[],
  { clientBokioCustomerId, periodStart, periodEnd, linkedBokioInvoiceIds }: InvoiceMatchQuery,
): InvoiceMatch | null {
  const candidates = invoices.filter(
    (invoice) =>
      invoice.customerId === clientBokioCustomerId &&
      !CREDIT_STATUSES.has(invoice.status) &&
      !linkedBokioInvoiceIds?.has(invoice.id),
  );

  const period = periodRe(periodStart, periodEnd);
  const strong = candidates.find((invoice) => hasLineMatching(invoice, period));
  if (strong) return { invoice: strong, strength: "strong" };

  const windowEnd = format(addDays(parseISO(periodEnd), WEAK_MATCH_WINDOW_DAYS), "yyyy-MM-dd");
  const weak = candidates.find(
    (invoice) =>
      invoice.invoiceDate !== null &&
      invoice.invoiceDate >= periodEnd &&
      invoice.invoiceDate <= windowEnd &&
      !hasLineMatching(invoice, ANY_PERIOD_RE),
  );
  return weak ? { invoice: weak, strength: "weak" } : null;
}

export type HoursComparison = { hoursMatch: boolean; bokioHours: number; appHours: number };

const HOURS_EPSILON = 0.001;

export function compareHours(invoice: BokioInvoice, appHours: number): HoursComparison {
  const bokioHours = invoice.lineItems
    .filter((line) => line.unitType === "hour")
    .reduce((sum, line) => sum + line.quantity, 0);
  return { hoursMatch: Math.abs(bokioHours - appHours) < HOURS_EPSILON, bokioHours, appHours };
}
