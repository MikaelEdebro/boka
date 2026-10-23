"use client";

import type { FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { HoursComparison } from "@/lib/invoiceMatching";
import { hoursMismatchConfirmation, linkedInvoiceMessage } from "@/lib/invoicing";
import { useActionWithToast } from "@/lib/useActionWithToast";
import { linkInvoice } from "./actions";

export function LinkInvoiceButton({
  yearMonth,
  clientId,
  bokioInvoiceId,
  invoiceNumber,
  hours,
  disabled,
}: {
  yearMonth: string;
  clientId: number;
  bokioInvoiceId: string;
  invoiceNumber: string | null;
  hours: HoursComparison;
  disabled: boolean;
}) {
  const [, formAction] = useActionWithToast(
    () => linkInvoice(yearMonth, clientId, bokioInvoiceId),
    { success: ({ invoiceNumber }) => linkedInvoiceMessage(invoiceNumber) },
  );

  function confirmHoursMismatch(event: FormEvent<HTMLFormElement>) {
    if (hours.hoursMatch) return;
    if (!window.confirm(hoursMismatchConfirmation(hours.bokioHours, hours.appHours))) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={confirmHoursMismatch}>
      <SubmitButton variant="outline" disabled={disabled}>
        {invoiceNumber ? `Koppla till Bokio-faktura #${invoiceNumber}` : "Koppla till Bokio-faktura"}
      </SubmitButton>
    </form>
  );
}
