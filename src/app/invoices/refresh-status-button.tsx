"use client";

import { SubmitButton } from "@/components/submit-button";
import { useActionWithToast } from "@/lib/useActionWithToast";
import { refreshInvoiceStatuses } from "./actions";

export function RefreshStatusButton() {
  const [, formAction] = useActionWithToast(() => refreshInvoiceStatuses(), {
    success: "Status uppdaterad från Bokio",
  });

  return (
    <form action={formAction}>
      <SubmitButton variant="outline" size="sm">
        Uppdatera status
      </SubmitButton>
    </form>
  );
}
