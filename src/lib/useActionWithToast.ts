"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actionResult";

export function useActionWithToast<Payload = FormData>(
  action: (prev: ActionResult | null, payload: Payload) => Promise<ActionResult>,
  { success }: { success: string },
) {
  return useActionState<ActionResult | null, Payload>(async (prev, payload) => {
    const result = await action(prev, payload);
    if (result.ok) toast.success(success);
    else toast.error(result.error);
    return result;
  }, null);
}
