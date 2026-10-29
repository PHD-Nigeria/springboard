import Link from "next/link";
import { listContent, listPublications, CONTENT_LIST_SORTS, type ContentListSort } from "@/lib/admin/queries";
import { getAdminSession } from "@/lib/auth/session";
import { CONTENT_STATUSES, CONTENT_TYPES, CONTENT_TYPE_LABELS, type ContentStatus, type ContentType } from "@/content-types/types";
import { AdminPageHeader, AdminInput, AdminSelect, AdminButton, AdminLabel, AdminEmptyState, StatusBadge, statusLabel } from "@/components/admin/ui";
import { ContentRowActions } from "@/components/admin/ContentRowActions";
import { formatContentDate } from "@/lib/content/format";

const FILTERABLE_TYPES = ["ARTICLE", "COMPANY_NEWS", "HEALTH_TIP", "GALLERY", "STAFF_SPOTLIGHT", "BIRTHDAY"] as const;
const NO_EDITION = "none";

type SearchParams = {
  status?: string;
  content_type?: string;
  q?: string;
  page?: string;
  author_id?: string;
  publication_id?: string;
  scope?: string;
  sort?: string;
};

function asContentStatus(value: string | undefined): ContentStatus | undefined {
  return value && (CONTENT_STATUSES as readonly string[]).includes(value) ? (value as ContentStatus) : undefined;
}

function asContentType(value: string | undefined): ContentType | undefined {
  return value && (CONTENT_TYPES as readonly string[]).includes(value) ? (value as ContentType) : undefined;
}

function asSort(value: string | undefined): ContentListSort {
  return CONTENT_LIST_SORTS.some((s) => s.value === value) ? (value as ContentListSort) : "updated_desc";
}

export default async function AdminContentListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const mine = params.scope === "mine";
  const [session, publications] = await Promise.all([getAdminSession(), listPublications()]);

  const { rows, total, pageSize } = await listContent({
    status: asContentStatus(params.status),
    contentType: asContentType(params.content_type),
    authorId: params.author_id,
    publicationId: params.publication_id && params.publication_id !== NO_EDITION ? params.publication_id : undefined,
    noPublication: params.publication_id === NO_EDITION,
    createdBy: mine ? session?.userId : undefined,
    search: params.q,
    sort: asSort(params.sort),
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseQuery = Object.fromEntries(Object.entries(params).filter(([key, value]) => key !== "page" && value)) as Record<string, string>;
  const hasFilters = Boolean(params.q || params.status || params.content_type || params.publication_id);

  return (
    <div>
      <AdminPageHeader
        title={mine ? "My work" : "All content"}
        description={`${total} item${total === 1 ? "" : "s"}${mine ? " you created" : ""}`}
        actions={
          <Link
            href="/admin/content/new"
            className="border border-secondary-400 bg-secondary-400 px-4 py-2 font-body text-sm font-medium text-primary-900 hover:bg-secondary-300"
          >
            New story
          </Link>
        }
      />

      <form className="mb-5 grid grid-cols-1 items-end gap-3 border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]" method="get">
        {mine && <input type="hidden" name="scope" value="mine" />}
        <div>
          <AdminLabel htmlFor="q">Search</AdminLabel>
          <AdminInput id="q" name="q" type="search" defaultValue={params.q ?? ""} placeholder="Title or web address…" />
        </div>
        <div>
          <AdminLabel htmlFor="status">Status</AdminLabel>
          <AdminSelect id="status" name="status" defaultValue={params.status ?? ""}>
            <option value="">All statuses</option>
            {CONTENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <AdminLabel htmlFor="content_type">Type</AdminLabel>
          <AdminSelect id="content_type" name="content_type" defaultValue={params.content_type ?? ""}>
            <option value="">All types</option>
            {FILTERABLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {CONTENT_TYPE_LABELS[type]}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <AdminLabel htmlFor="publication_id">Edition</AdminLabel>
          <AdminSelect id="publication_id" name="publication_id" defaultValue={params.publication_id ?? ""}>
            <option value="">All editions</option>
            <option value={NO_EDITION}>No edition assigned</option>
            {publications.map((publication) => (
              <option key={publication.id} value={publication.id}>
                {publication.title}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <AdminLabel htmlFor="sort">Sort</AdminLabel>
          <AdminSelect id="sort" name="sort" defaultValue={asSort(params.sort)}>
            {CONTENT_LIST_SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div className="flex gap-2">
          <AdminButton type="submit" variant="secondary">
            Apply
          </AdminButton>
          {hasFilters && (
            <Link href={mine ? "/admin/content?scope=mine" : "/admin/content"} className="px-2 py-2 font-body text-sm text-primary-600 underline underline-offset-2">
              Clear
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <AdminEmptyState title={hasFilters ? "No stories match these filters" : mine ? "You haven't created any stories yet" : "No stories yet"}>
          {hasFilters ? "Try clearing a filter or searching for a different word." : <Link href="/admin/content/new" className="text-primary-600 underline">Start a new story</Link>}
        </AdminEmptyState>
      ) : (
        <div className="border border-border bg-surface">
          <div className="hidden grid-cols-[minmax(0,1fr)_9rem_8rem_auto] gap-4 border-b border-border bg-surface-raised px-4 py-2 font-body text-xs font-semibold tracking-wide text-foreground-muted uppercase md:grid">
            <span>Title</span>
            <span>Status</span>
            <span>Updated</span>
            <span>Actions</span>
          </div>
          <ul>
            {rows.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]"
              >
                <div className="min-w-0">
                  <Link
                    href={item.status === "archived" ? `/admin/content/${item.id}/preview` : `/admin/content/${item.id}`}
                    className="block truncate font-body text-sm font-semibold text-foreground hover:text-primary-600 hover:underline"
                  >
                    {item.title}
                  </Link>
                  <p className="truncate font-body text-xs text-foreground-muted">
                    {CONTENT_TYPE_LABELS[item.content_type]} · {item.content_author?.name ?? "No author"} ·{" "}
                    {item.content_publication?.title ?? "No edition assigned"}
                  </p>
                  {item.status === "scheduled" && item.publish_at && (
                    <p className="truncate font-body text-xs font-medium text-foreground">
                      Scheduled for{" "}
                      {new Date(item.publish_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
                <div>
                  <StatusBadge status={item.status} />
                </div>
                <span className="font-body text-xs text-foreground-muted">
                  <span className="md:hidden">Updated </span>
                  {formatContentDate(item.updated_at)}
                </span>
                <ContentRowActions id={item.id} status={item.status} title={item.title} canPublish={session?.role !== "contributor"} canDelete={session?.role === "admin"} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center gap-3 font-body text-sm text-foreground-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`?${new URLSearchParams({ ...baseQuery, page: String(page - 1) }).toString()}`} className="border border-border bg-surface px-3 py-1 text-foreground hover:border-border-strong">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={`?${new URLSearchParams({ ...baseQuery, page: String(page + 1) }).toString()}`} className="border border-border bg-surface px-3 py-1 text-foreground hover:border-border-strong">
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
