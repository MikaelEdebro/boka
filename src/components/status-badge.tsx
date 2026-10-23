import { cn } from "@/lib/utils";

type BadgeStyle = { label: string; className: string };

const GREY = "bg-muted text-foreground";
const GREEN = "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100";

const STATUS_BADGES: Record<string, BadgeStyle> = {
  draft: { label: "Utkast", className: GREY },
  published: {
    label: "Publicerad",
    className: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  },
  paid: { label: "Betald", className: GREEN },
  overPaid: { label: "Betald", className: GREEN },
  underPaid: { label: "Betald", className: GREEN },
  overdue: {
    label: "Förfallen",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  },
  credited: { label: "Krediterad", className: GREY },
  credit: { label: "Krediterad", className: GREY },
  deleted: {
    label: "Borttagen i Bokio",
    className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  },
};

const UNKNOWN: BadgeStyle = { label: "Okänd", className: GREY };

export function invoiceStatusBadge(status: string | null | undefined): BadgeStyle {
  if (!status) return UNKNOWN;
  return STATUS_BADGES[status] ?? UNKNOWN;
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const badge = invoiceStatusBadge(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        badge.className,
      )}
    >
      {badge.label}
    </span>
  );
}
