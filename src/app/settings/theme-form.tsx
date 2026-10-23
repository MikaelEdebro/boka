"use client";

import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Theme } from "@/db/schema";
import { useActionWithToast } from "@/lib/useActionWithToast";
import { saveSettings } from "./actions";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Ljust" },
  { value: "dark", label: "Mörkt" },
  { value: "system", label: "System" },
];

export function ThemeForm({ theme }: { theme: Theme }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [, formAction, pending] = useActionWithToast(saveSettings, {
    success: "Inställningar sparade",
  });

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <h2 id="theme-label" className="text-sm font-medium text-muted-foreground">
        Tema
      </h2>
      <RadioGroup
        name="theme"
        defaultValue={theme}
        onValueChange={() => formRef.current?.requestSubmit()}
        disabled={pending}
        aria-labelledby="theme-label"
        className="flex flex-wrap gap-6"
      >
        {THEME_OPTIONS.map((option) => (
          <Label key={option.value} className="font-normal">
            <RadioGroupItem value={option.value} />
            {option.label}
          </Label>
        ))}
      </RadioGroup>
    </form>
  );
}
