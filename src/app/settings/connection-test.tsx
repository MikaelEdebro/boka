"use client";

import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { testBokioConnection } from "./actions";

export function ConnectionTest() {
  async function runConnectionTest() {
    const result = await testBokioConnection();
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
  }

  return (
    <form action={runConnectionTest}>
      <div className="flex justify-end">
        <SubmitButton variant="outline">Testa Bokio-anslutning</SubmitButton>
      </div>
    </form>
  );
}
