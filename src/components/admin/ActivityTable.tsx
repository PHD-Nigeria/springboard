import type { AdminAuditLogRow } from "@/lib/admin/queries";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  PUBLISH: "Published",
  UNPUBLISH: "Unpublished",
  ARCHIVE: "Archived",
  RESTORE: "Restored",
  DELETE: "Deleted",
  UPLOAD: "Uploaded",
  PROMOTE: "Promoted to public",
  REPLACE: "Replaced",
  ROLE_CHANGE: "Changed role",
  SETTINGS_UPDATE: "Updated settings",
  SCHEDULE: "Scheduled",
  CANCEL_SCHEDULE: "Cancelled schedule",
};

const ENTITY_LABELS: Record<string, string> = {
  CONTENT: "content",
  MEDIA: "media",
  AUTHOR: "contributor",
  CATEGORY: "category",
  SECTION: "section",
  PUBLICATION: "publication",
  USER: "user",
  SETTINGS: "settings",
};

/** Turns each action's stored metadata into the single human-readable "Object" cell the brief's mockup shows. */
function describeObject(row: AdminAuditLogRow): string {
  const m = row.metadata;
  if (row.action === "ROLE_CHANGE") {
    return `${m.role_before ?? "?"} → ${m.role_after ?? "?"}`;
  }
  if (row.action === "SETTINGS_UPDATE") {
    return "Default publication";
  }
  if (row.entity_type === "MEDIA") {
    return String(m.filename_after ?? m.filename ?? m.filename_before ?? "(untitled)");
  }
  if (row.entity_type === "CONTENT") {
    return String(m.title ?? "(untitled)");
  }
  return String(m.title ?? m.name ?? "(untitled)");
}

export function ActivityTable({ rows }: { rows: AdminAuditLogRow[] }) {
  return (
    <div className="border border-border">
      <div className="grid grid-cols-[1fr_1fr_2fr_1fr] gap-4 border-b border-border bg-background px-4 py-2 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
        <span>Who</span>
        <span>Action</span>
        <span>Object</span>
        <span>Date</span>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 font-body text-sm text-foreground-muted">No activity matches these filters.</p>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_1fr_2fr_1fr] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            <p className="truncate font-body text-sm text-foreground">{row.actor_name ?? "Unknown"}</p>
            <p className="truncate font-body text-sm text-foreground-muted">
              {ACTION_LABELS[row.action] ?? row.action} <span className="text-xs">{ENTITY_LABELS[row.entity_type]}</span>
            </p>
            <p className="truncate font-body text-sm text-foreground">{describeObject(row)}</p>
            <p className="truncate font-body text-xs text-foreground-muted">
              {new Date(row.created_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
