"use client";

import { useState, useTransition } from "react";
import { AdminButton, AdminCard, AdminInput, AdminLabel, AdminNotice } from "@/components/admin/ui";
import { saveIdeasEmailAction } from "@/lib/admin/ideas-email-actions";

export function IdeasEmailForm({ initial, isAdmin, available }: { initial: string; isAdmin: boolean; available: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  return (
    <AdminCard className="max-w-xl">
      <h2 className="font-display text-base font-semibold text-foreground">Share Your Ideas</h2>
      <p className="mt-1 font-body text-sm text-foreground-muted">
        The header button opens an email to this address with the subject “Springboard – Suggestions &amp; Ideas”. Until an address is saved, the button stays disabled.
      </p>
      {!available ? (
        <p className="mt-3 font-body text-sm text-foreground-muted">This setting is not available in this environment yet (the migration has not been applied).</p>
      ) : (
        <form
          className="mt-3 space-y-3"
          action={(formData) =>
            startTransition(async () => {
              const r = await saveIdeasEmailAction(formData);
              setMessage(r.error ? { tone: "error", text: r.error } : { tone: "success", text: "Saved." });
            })
          }
        >
          <div>
            <AdminLabel htmlFor="ideas_email">Recipient email address</AdminLabel>
            <AdminInput id="ideas_email" name="ideas_email" type="email" defaultValue={initial} disabled={!isAdmin} maxLength={254} />
          </div>
          <div role="status" aria-live="polite">{message && <AdminNotice tone={message.tone}>{message.text}</AdminNotice>}</div>
          {isAdmin ? <AdminButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</AdminButton> : <p className="font-body text-xs text-foreground-muted">Only an administrator can change this.</p>}
        </form>
      )}
    </AdminCard>
  );
}
