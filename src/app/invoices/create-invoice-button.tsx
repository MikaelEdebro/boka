"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/actionResult";
import { createInvoiceForMonth } from "./actions";

export function CreateInvoiceButton({
  yearMonth,
  disabled,
}: {
  yearMonth: string;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null>(
    () => createInvoiceForMonth(yearMonth),
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("Faktura skapad i Bokio");
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <SubmitButton disabled={disabled}>Skapa faktura</SubmitButton>
    </form>
  );
}
