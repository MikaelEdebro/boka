"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { setVabDayReported } from "./actions";

export function VabReportedCheckbox({ date, reported }: { date: string; reported: boolean }) {
  const [checked, setChecked] = useState(reported);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await setVabDayReported(date, next);
      if (!result.ok) {
        setChecked(!next);
        toast.error(result.error);
      }
    });
  }

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={toggle}
      disabled={pending}
      aria-label={`Rapporterad ${date}`}
    />
  );
}
