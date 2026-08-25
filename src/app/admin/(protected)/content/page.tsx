import Link from "next/link";
import { listContent } from "@/lib/admin/queries";
import { CONTENT_STATUSES, CONTENT_TYPES, type ContentStatus, type ContentType } from "@/content-types/types";
import { AdminPageHeader, AdminInput, AdminSelect, AdminButton, StatusBadge } from "@/components/admin/ui";
import { ContentRowActions } from "@/components/admin/ContentRowActions";
import { formatContentDate } from "@/lib/content/format";

const FILTERABLE_TYPES = ["ARTICLE", "COMPANY_NEWS"] as const;

type SearchParams = {
  status?: string;
  content_type?: string;
  q?: string;
  page?: string;
  author_id?: string;
  publication_id?: string;
};

function asContentStatus(value: string | undefined): ContentStatus | undefined {
  return value && (CONTENT_STATUSES as readonly string[]).includes(value) ? (value as ContentStatus) : undefined;
}

function asContentType(value: string | undefined): ContentType | undefined {
  return value && (CONTENT_TYPES as readonly string[]).includes(value) ? (value as ContentType) : undefined;
}

export default async function AdminContentListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;

  const { rows, total, pageSize } = await listContent({
    status: asContentStatus(params.status),
    contentType: asContentType(params.content_type),
    authorId: params.author_id,
    publicationId: params.publication_id,
    search: params.q,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseQuery = Object.fromEntries(
    Object.entries(params).filter(([key, value]) => key !== "page" && value)
  ) as Record<string, string>;

  return (
    <div>
      <AdminPageHeader
        title="Content"
        description={`${total} item${total === 1 ? "" : "s"}`}
        actions={
          <Link
            href="/admin/content/new"
            className="border border-secondary-400 bg-secondary-400 px-4 py-2 font-body text-sm font-medium text-primary-900 hover:bg-secondary-300"
          >
            New content
          </Link>
        }
      />

      <form className="mb-6 flex flex-wrap items-end gap-4" method="get">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase" htmlFor="q">
            Search
          </label>
          <AdminInput id="q" name="q" defaultValue={params.q ?? ""} placeholder="Title or slug…" />
        </div>
        <div>
          <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase" htmlFor="status">
            Status
          </label>
          <AdminSelect id="status" name="status" defaultValue={params.status ?? ""}>
            <option value="">All statuses</option>
            {CONTENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase" htmlFor="content_type">
            Type
          </label>
          <AdminSelect id="content_type" name="content_type" defaultValue={params.content_type ?? ""}>
            <option value="">All types</option>
            {FILTERABLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </AdminSelect>
        </div>
        <AdminButton type="submit" variant="secondary">
          Filter
        </AdminButton>
      </form>

      <div className="border border-border">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border bg-background px-4 py-2 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
          <span>Title</span>
          <span>Status</span>
          <span>Updated</span>
          <span>Actions</span>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 font-body text-sm text-foreground-muted">No content matches these filters.</p>
        ) : (
          rows.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <Link
                  href={item.status === "archived" ? `/admin/content/${item.id}/preview` : `/admin/content/${item.id}`}
                  className="block truncate font-body text-sm text-foreground hover:text-secondary-400"
                >
                  {item.title}
                </Link>
                <p className="truncate font-body text-xs text-foreground-muted">
                  {item.content_type} · {item.content_author?.name ?? "No author"} ·{" "}
                  {item.content_publication?.title ?? "No publication"}
                </p>
                {item.status === "scheduled" && item.publish_at && (
                  <p className="truncate font-body text-xs text-coral">
                    Scheduled for{" "}
                    {new Date(item.publish_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              <StatusBadge status={item.status} />
              <span className="font-body text-xs text-foreground-muted">{formatContentDate(item.updated_at)}</span>
              <ContentRowActions id={item.id} status={item.status} />
            </div>
          ))
        )}
      </div>

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
