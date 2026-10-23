"use client";

import { SubmitButton } from "@/components/submit-button";
import { refreshStatusMessage } from "@/lib/invoicing";
import { useActionWithToast } from "@/lib/useActionWithToast";
import { refreshInvoiceStatuses } from "./actions";

export function RefreshStatusButton() {
  const [, formAction] = useActionWithToast(() => refreshInvoiceStatuses(), {
    success: ({ removed }) => refreshStatusMessage(removed),
  });

  return (
    <form action={formAction}>
      <SubmitButton variant="outline" size="sm">
        Uppdatera status
      </SubmitButton>
    </form>
  );
}
