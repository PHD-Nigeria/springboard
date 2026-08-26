import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { listAuditLog, listAuditActors } from "@/lib/admin/queries";
import { AdminPageHeader, AdminInput, AdminSelect, AdminButton } from "@/components/admin/ui";
import { ActivityTable } from "@/components/admin/ActivityTable";
import Link from "next/link";

type SearchParams = {
  user?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  page?: string;
};

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "PUBLISH",
  "UNPUBLISH",
  "ARCHIVE",
  "RESTORE",
  "DELETE",
  "UPLOAD",
  "PROMOTE",
  "REPLACE",
  "ROLE_CHANGE",
  "SETTINGS_UPDATE",
  "SCHEDULE",
  "CANCEL_SCHEDULE",
] as const;

const ENTITY_TYPES = ["CONTENT", "MEDIA", "AUTHOR", "CATEGORY", "SECTION", "PUBLICATION", "USER", "SETTINGS", "NAV_ITEM"] as const;

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getAdminSession();
  // audit_log's RLS already returns zero rows to a contributor session, but
  // redirecting away entirely (rather than showing a permanently-empty
  // page) matches the brief's "no global audit access" more honestly.
  if (!session || session.role === "contributor") redirect("/admin");

  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;

  const [{ rows, total, pageSize }, actors] = await Promise.all([
    listAuditLog({
      actorUserId: params.user || undefined,
      action: params.action as (typeof ACTIONS)[number] | undefined,
      entityType: params.entity_type as (typeof ENTITY_TYPES)[number] | undefined,
      dateFrom: params.date_from ? new Date(params.date_from).toISOString() : undefined,
      dateTo: params.date_to ? new Date(`${params.date_to}T23:59:59`).toISOString() : undefined,
      page,
    }),
    listAuditActors(),
  ]);

  // Editors get "limited editorial activity visibility" (§8) — RLS already
  // excludes USER/SETTINGS rows from what they can read, so hiding those
  // two filter options for them too is just avoiding a filter that would
  // always return nothing, not a second enforcement layer.
  const visibleEntityTypes = session.role === "admin" ? ENTITY_TYPES : ENTITY_TYPES.filter((t) => t !== "USER" && t !== "SETTINGS");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseQuery = Object.fromEntries(
    Object.entries(params).filter(([key, value]) => key !== "page" && value)
  ) as Record<string, string>;

  return (
    <div>
      <AdminPageHeader title="Activity" description={`${total} recorded event${total === 1 ? "" : "s"}`} />

      <form className="mb-6 flex flex-wrap items-end gap-4" method="get">
        <div>
          <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase" htmlFor="user">
            User
          </label>
          <AdminSelect id="user" name="user" defaultValue={params.user ?? ""}>
            <option value="">All users</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.label}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase" htmlFor="action">
            Action
          </label>
          <AdminSelect id="action" name="action" defaultValue={params.action ?? ""}>
            <option value="">All actions</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase" htmlFor="entity_type">
            Entity type
          </label>
          <AdminSelect id="entity_type" name="entity_type" defaultValue={params.entity_type ?? ""}>
            <option value="">All types</option>
            {visibleEntityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase" htmlFor="date_from">
            From
          </label>
          <AdminInput id="date_from" name="date_from" type="date" defaultValue={params.date_from ?? ""} />
        </div>
        <div>
          <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase" htmlFor="date_to">
            To
          </label>
          <AdminInput id="date_to" name="date_to" type="date" defaultValue={params.date_to ?? ""} />
        </div>
        <AdminButton type="submit" variant="secondary">
          Filter
        </AdminButton>
      </form>

      <ActivityTable rows={rows} />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-2 font-body text-sm text-foreground-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?${new URLSearchParams({ ...baseQuery, page: String(page - 1) }).toString()}`}
                className="border border-border px-3 py-1 hover:text-foreground"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?${new URLSearchParams({ ...baseQuery, page: String(page + 1) }).toString()}`}
                className="border border-border px-3 py-1 hover:text-foreground"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
