"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** One-button form that asks before running a destructive server action. */
export function ConfirmForm({
  action,
  confirm,
  children,
  variant = "ghost",
}: {
  action: () => Promise<void>;
  confirm: string;
  children: ReactNode;
  variant?: "ghost" | "danger";
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <Button type="submit" size="sm" variant={variant}>
        {children}
      </Button>
    </form>
  );
}
