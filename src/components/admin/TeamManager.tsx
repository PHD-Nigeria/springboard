"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminButton, AdminInput, AdminLabel, AdminNotice } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  createTeamMemberAction,
  updateTeamMemberAction,
  setTeamMemberVisibilityAction,
  moveTeamMemberAction,
  deleteTeamMemberAction,
  type TeamActionResult,
} from "@/lib/admin/team-actions";
import type { TeamMember } from "@/lib/content/team-queries";

/** Every control calls the real server action; the list is re-read from the server after each change (router.refresh), so what is shown is what is stored. */
export function TeamManager({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", role: "" });
  const [adding, setAdding] = useState({ name: "", role: "" });
  const [deleting, setDeleting] = useState<TeamMember | null>(null);

  function run(action: () => Promise<TeamActionResult>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({ tone: "success", text: success });
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div role="status" aria-live="polite">
        {message && <AdminNotice tone={message.tone === "error" ? "error" : "success"}>{message.text}</AdminNotice>}
      </div>

      {members.length === 0 ? (
        <AdminNotice tone="info">There are no team members yet. Add the first one below; nothing is shown on the homepage until one is visible.</AdminNotice>
      ) : (
        <ol aria-label="Team members in display order" className="divide-y divide-border border border-border bg-surface">
          {members.map((member, index) => {
            const editing = editingId === member.id;
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span aria-hidden="true" className="w-6 font-body text-sm text-foreground-muted">{index + 1}</span>
                {editing ? (
                  <form
                    className="flex min-w-0 flex-1 flex-wrap items-end gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      run(() => updateTeamMemberAction(member.id, draft), "Saved.", () => setEditingId(null));
                    }}
                  >
                    <div className="min-w-40 flex-1">
                      <AdminLabel htmlFor={`name-${member.id}`}>Name</AdminLabel>
                      <AdminInput id={`name-${member.id}`} value={draft.name} maxLength={120} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </div>
                    <div className="min-w-48 flex-[2]">
                      <AdminLabel htmlFor={`role-${member.id}`}>Role</AdminLabel>
                      <AdminInput id={`role-${member.id}`} value={draft.role} maxLength={160} required onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
                    </div>
                    <AdminButton type="submit" disabled={pending}>Save</AdminButton>
                    <AdminButton type="button" variant="secondary" onClick={() => setEditingId(null)}>Cancel</AdminButton>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base font-semibold text-foreground">{member.name}</p>
                      <p className="font-body text-sm text-foreground-muted">{member.role}</p>
                    </div>
                    <span className={`border px-2 py-0.5 font-body text-xs font-semibold ${member.isVisible ? "border-primary-500 text-primary-700" : "border-border text-foreground-muted"}`}>
                      {member.isVisible ? "Shown on homepage" : "Hidden"}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <AdminButton type="button" variant="secondary" disabled={pending || index === 0} aria-label={`Move ${member.name} up`} onClick={() => run(() => moveTeamMemberAction(member.id, "up"), `${member.name} moved up.`)}>Up</AdminButton>
                      <AdminButton type="button" variant="secondary" disabled={pending || index === members.length - 1} aria-label={`Move ${member.name} down`} onClick={() => run(() => moveTeamMemberAction(member.id, "down"), `${member.name} moved down.`)}>Down</AdminButton>
                      <AdminButton type="button" variant="secondary" disabled={pending} onClick={() => { setEditingId(member.id); setDraft({ name: member.name, role: member.role }); }} aria-label={`Edit ${member.name}`}>Edit</AdminButton>
                      <AdminButton type="button" variant="secondary" disabled={pending} onClick={() => run(() => setTeamMemberVisibilityAction(member.id, !member.isVisible), member.isVisible ? `${member.name} is now hidden.` : `${member.name} is now shown.`)} aria-label={`${member.isVisible ? "Hide" : "Show"} ${member.name}`}>
                        {member.isVisible ? "Hide" : "Show"}
                      </AdminButton>
                      <AdminButton type="button" variant="danger" disabled={pending} onClick={() => setDeleting(member)} aria-label={`Remove ${member.name}`}>Remove</AdminButton>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <form
        className="flex flex-wrap items-end gap-3 border border-border bg-surface p-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => createTeamMemberAction(adding), "Team member added.", () => setAdding({ name: "", role: "" }));
        }}
      >
        <h2 className="w-full font-display text-base font-semibold text-foreground">Add a team member</h2>
        <div className="min-w-40 flex-1">
          <AdminLabel htmlFor="new-name">Name</AdminLabel>
          <AdminInput id="new-name" value={adding.name} maxLength={120} required onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
        </div>
        <div className="min-w-48 flex-[2]">
          <AdminLabel htmlFor="new-role">Role</AdminLabel>
          <AdminInput id="new-role" value={adding.role} maxLength={160} required onChange={(e) => setAdding({ ...adding, role: e.target.value })} />
        </div>
        <AdminButton type="submit" disabled={pending}>Add</AdminButton>
      </form>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Remove ${deleting.name}?` : "Remove team member?"}
        description="They will no longer appear on the homepage. If you only want to hide them for now, use Hide instead."
        confirmLabel="Remove"
        destructive
        pending={pending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          if (!target) return;
          run(() => deleteTeamMemberAction(target.id), `${target.name} was removed.`, () => setDeleting(null));
        }}
      />
    </div>
  );
}
