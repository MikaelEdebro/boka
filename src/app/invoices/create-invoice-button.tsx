"use client";

import { SubmitButton } from "@/components/submit-button";
import { useActionWithToast } from "@/lib/useActionWithToast";
import { createInvoiceForMonth } from "./actions";

export function CreateInvoiceButton({
  yearMonth,
  disabled,
}: {
  yearMonth: string;
  disabled: boolean;
}) {
  const [, formAction] = useActionWithToast(() => createInvoiceForMonth(yearMonth), {
    success: "Faktura skapad i Bokio",
  });

  return (
    <form action={formAction}>
      <SubmitButton disabled={disabled}>Skapa faktura</SubmitButton>
    </form>
  );
}
