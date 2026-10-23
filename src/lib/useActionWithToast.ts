"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actionResult";

export function useActionWithToast<Payload = FormData, Result extends ActionResult = ActionResult>(
  action: (prev: Result | null, payload: Payload) => Promise<Result>,
  { success }: { success: string | ((result: Extract<Result, { ok: true }>) => string) },
) {
  return useActionState<Result | null, Payload>(async (prev, payload) => {
    const result = await action(prev, payload);
    if (result.ok) {
      toast.success(
        typeof success === "string" ? success : success(result as Extract<Result, { ok: true }>),
      );
    } else {
      toast.error(result.error);
    }
    return result;
  }, null);
}
