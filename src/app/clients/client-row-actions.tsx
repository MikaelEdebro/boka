"use client";

import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { makeDefaultClient, removeClient } from "./actions";

export function MakeDefaultButton({ id }: { id: number }) {
  async function action() {
    const result = await makeDefaultClient(id);
    if (!result.ok) toast.error(result.error);
  }

  return (
    <form action={action}>
      <SubmitButton variant="outline" size="sm">
        Gör till standard
      </SubmitButton>
    </form>
  );
}

export function DeleteClientButton({ id, recordCount }: { id: number; recordCount: number }) {
  const blockedReason =
    recordCount > 0
      ? `Kunden har tidrapporter eller fakturor (${recordCount} st) och kan inte tas bort.`
      : undefined;

  async function action() {
    const result = await removeClient(id);
    if (result.ok) toast.success("Kund borttagen");
    else toast.error(result.error);
  }

  return (
    <form action={action} title={blockedReason}>
      <SubmitButton variant="ghost" size="sm" disabled={blockedReason != null}>
        Ta bort
      </SubmitButton>
    </form>
  );
}
