import Link from "next/link";
import { listEditionSummaries } from "@/lib/admin/queries";
import { AdminPageHeader, AdminEmptyState, StatusBadge } from "@/components/admin/ui";
import { NewEditionPanel } from "@/components/admin/NewEditionPanel";

export default async function AdminEditionsPage() {
  const editions = await listEditionSummaries();

  return (
    <div>
      <AdminPageHeader
        title="Editions / quarters"
        description="Each edition groups a quarter's stories, sections and media. Open an edition to see what is ready."
        actions={<NewEditionPanel />}
      />

      {editions.length === 0 ? (
        <AdminEmptyState title="No editions yet">Create the first edition, then assign stories to it from the story editor.</AdminEmptyState>
      ) : (
        <ul className="space-y-3">
          {editions.map((edition) => (
            <li key={edition.id} className="border border-border bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-base font-semibold text-foreground">
                    <Link href={`/admin/publications/${edition.id}`} className="hover:text-primary-600 hover:underline">
                      {edition.title}
                    </Link>
                  </h2>
                  <p className="font-body text-xs text-foreground-muted">/{edition.slug}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {edition.isActive && (
                    <span className="border border-primary-500 bg-secondary-400 px-2 py-0.5 font-body text-xs font-bold text-primary-900">Active edition</span>
                  )}
                  <StatusBadge status={edition.status} />
                  <Link
                    href={`/admin/publications/${edition.id}`}
                    className="border border-border-strong bg-surface px-3 py-1.5 font-body text-sm font-medium text-foreground hover:bg-surface-raised"
                  >
                    Open workspace
                  </Link>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-4 lg:grid-cols-7">
                {[
                  { label: "Stories", value: edition.total, href: `/admin/content?publication_id=${edition.id}` },
                  { label: "Published", value: edition.counts.published, href: `/admin/content?publication_id=${edition.id}&status=published` },
                  { label: "In review", value: edition.counts.review, href: `/admin/content?publication_id=${edition.id}&status=review`, attention: edition.counts.review > 0 },
                  { label: "Scheduled", value: edition.counts.scheduled, href: `/admin/content?publication_id=${edition.id}&status=scheduled` },
                  { label: "Drafts", value: edition.counts.draft, href: `/admin/content?publication_id=${edition.id}&status=draft` },
                  { label: "Sections", value: edition.sectionCount, href: `/admin/sections?publication_id=${edition.id}` },
                  { label: "Media files", value: edition.mediaCount, href: `/admin/publications/${edition.id}#media` },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="font-body text-xs text-foreground-muted">{stat.label}</dt>
                    <dd className="font-display text-xl font-semibold text-foreground">
                      <Link href={stat.href} className="hover:text-primary-600 hover:underline">
                        {stat.value}
                      </Link>
                      {stat.attention && <span className="ml-1 font-body text-xs font-semibold text-danger">needs review</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
