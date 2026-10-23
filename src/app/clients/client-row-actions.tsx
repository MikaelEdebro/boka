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

export function DeleteClientButton({ id }: { id: number }) {
  async function action() {
    const result = await removeClient(id);
    if (result.ok) toast.success("Kund borttagen");
    else toast.error(result.error);
  }

  return (
    <form action={action}>
      <SubmitButton variant="ghost" size="sm">
        Ta bort
      </SubmitButton>
    </form>
  );
}
