"use client";

import { Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";

/** "Have an invite code?" → /join/{code} */
export function InviteForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase();
        if (c) router.push(`/join/${encodeURIComponent(c)}`);
      }}
    >
      <label htmlFor="invite" className="text-sm font-extrabold">
        {t("inviteTitle")}
      </label>
      <div className="flex gap-2">
        <Input
          id="invite"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="SOZ7A1"
          autoCapitalize="characters"
          aria-label={t("inviteLabel")}
          className="font-mono uppercase"
          maxLength={20}
        />
        <Button type="submit" variant="accent" className="min-h-12 shrink-0">
          <Ticket aria-hidden />
          {t("inviteSubmit")}
        </Button>
      </div>
    </form>
  );
}
