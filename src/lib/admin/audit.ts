import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type AuditAction = Database["public"]["Enums"]["audit_action"];
type AuditEntityType = Database["public"]["Enums"]["audit_entity_type"];

interface AuditEventInput {
  /**
   * Null only for the one legitimate actor-less case: the scheduled-publish
   * cron job (src/app/api/cron/publish-scheduled/route.ts), which runs with
   * no authenticated human session. Every interactive Server Action always
   * passes the real signed-in user's id.
   */
  actorUserId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Writes one audit_log row through the caller's own cookie-based client —
 * never the service-role client — so audit_log_insert's RLS
 * (actor_user_id = auth.uid()) is what actually stops a forged actor id,
 * not application code alone. The one exception is the cron route above,
 * which legitimately uses the service-role client (no session exists to
 * be RLS-subject to) and passes actorUserId: null.
 *
 * Called AFTER the mutation it's recording has already succeeded, and
 * deliberately best-effort: this is an observability record, not the
 * primary operation. A failure here is logged and swallowed rather than
 * surfaced as an error to the editor, or (worse) used to roll back a
 * mutation that already succeeded — see docs/architecture.md's Phase 4D
 * section for why true cross-table atomicity isn't attempted here.
 */
export async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  { actorUserId, action, entityType, entityId, metadata }: AuditEventInput
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: (metadata ?? {}) as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["metadata"],
  });
  if (error) {
    console.error("audit log write failed:", action, entityType, entityId, error.message);
  }
}
