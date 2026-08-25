import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthorById, listContent } from "@/lib/admin/queries";
import { AuthorForm } from "@/components/admin/AuthorForm";
import { AdminPageHeader, StatusBadge } from "@/components/admin/ui";
import { formatContentDate } from "@/lib/content/format";

export default async function EditContributorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const author = await getAuthorById(id);
  if (!author) notFound();

  // Reuses the same admin content query the Content list page uses — RLS
  // (content_select_own/content_select_staff) already scopes this to
  // whatever the viewer is actually allowed to see: an admin/editor sees
  // this contributor's drafts and archived work too, a contributor viewing
  // someone else's page only sees their published content.
  const { rows: articles, total } = await listContent({ authorId: id, pageSize: 10 });

  return (
    <div>
      <AdminPageHeader title={`Edit: ${author.name}`} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <AuthorForm author={author} />

        <div>
          <h2 className="mb-3 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
            Articles by {author.name} ({total})
          </h2>
          <div className="border border-border">
            {articles.length === 0 && (
              <p className="p-4 font-body text-sm text-foreground-muted">No articles yet.</p>
            )}
            {articles.map((item) => (
              <Link
                key={item.id}
                href={item.status === "archived" ? `/admin/content/${item.id}/preview` : `/admin/content/${item.id}`}
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:border-secondary-400"
              >
                <div className="min-w-0">
                  <p className="truncate font-body text-sm text-foreground">{item.title}</p>
                  <p className="truncate font-body text-xs text-foreground-muted">{formatContentDate(item.updated_at)}</p>
                </div>
                <StatusBadge status={item.status} />
              </Link>
            ))}
          </div>
          {total > articles.length && (
            <Link
              href={`/admin/content?author_id=${id}`}
              className="mt-3 inline-block font-body text-sm text-foreground-muted hover:text-secondary-400"
            >
              View all {total} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
