"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { testBokioConnection, type ConnectionTestResult } from "./actions";

export function ConnectionTest() {
  const [, formAction] = useActionState<ConnectionTestResult | null>(async () => {
    const result = await testBokioConnection();
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
    return result;
  }, null);

  return (
    <form action={formAction}>
      <SubmitButton variant="outline">Testa Bokio-anslutning</SubmitButton>
    </form>
  );
}
