import Link from "next/link";
import { getDashboardStats, getMyWorkCounts, getActiveEditionSnapshot } from "@/lib/admin/queries";
import { getAdminSession } from "@/lib/auth/session";
import { AdminPageHeader, AdminEmptyState, StatusBadge, statusLabel } from "@/components/admin/ui";
import { ActivityTable } from "@/components/admin/ActivityTable";
import { formatContentDate } from "@/lib/content/format";
import { CONTENT_STATUSES } from "@/content-types/types";

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-surface" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-raised px-4 py-2">
        <h2 className="font-display text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const linkClass = "font-body text-xs font-medium text-primary-600 underline-offset-2 hover:underline";

function StoryRow({ id, title, sub, right }: { id: string; title: string; sub: string; right: React.ReactNode }) {
  return (
    <Link href={`/admin/content/${id}`} className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-raised">
      <div className="min-w-0">
        <p className="truncate font-body text-sm font-medium text-foreground">{title}</p>
        <p className="truncate font-body text-xs text-foreground-muted">{sub}</p>
      </div>
      <div className="shrink-0 font-body text-xs text-foreground-muted">{right}</div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  const isContributor = session?.role === "contributor";
  const [stats, mine, edition] = await Promise.all([
    getDashboardStats(),
    session ? getMyWorkCounts(session.userId) : Promise.resolve(null),
    getActiveEditionSnapshot(),
  ]);

  const attention = [
    !isContributor && { label: "Waiting for review", value: stats.counts.review, href: "/admin/review", note: "Review queue" },
    { label: "Scheduled", value: stats.counts.scheduled, href: "/admin/content?status=scheduled", note: "Publishes automatically" },
    { label: "Drafts", value: stats.counts.draft, href: "/admin/content?status=draft", note: "Not yet submitted" },
    { label: "Published", value: stats.counts.published, href: "/admin/content?status=published", note: "Live on the site" },
  ].filter(Boolean) as { label: string; value: number; href: string; note: string }[];

  return (
    <div>
      <AdminPageHeader
        title="Overview"
        description={isContributor ? "Your stories and what happens next." : "What needs attention across Springboard."}
        actions={
          <Link href="/admin/content/new" className="border border-secondary-400 bg-secondary-400 px-4 py-2 font-body text-sm font-medium text-primary-900 hover:bg-secondary-300">
            New story
          </Link>
        }
      />

      <ul className={`mb-6 grid grid-cols-2 gap-3 ${attention.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {attention.map((tile) => (
          <li key={tile.label}>
            <Link href={tile.href} className="block border border-border border-t-[3px] border-t-primary-500 bg-surface px-4 py-3 hover:border-border-strong">
              <p className="font-display text-3xl font-semibold text-foreground">{tile.value}</p>
              <p className="font-body text-sm font-medium text-foreground">{tile.label}</p>
              <p className="font-body text-xs text-foreground-muted">{tile.note}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <Panel title="Active edition" action={<Link href="/admin/publications" className={linkClass}>All editions</Link>}>
            {edition ? (
              <div className="px-4 py-3">
                <p className="font-display text-base font-semibold text-foreground">{edition.title}</p>
                <p className="mb-2 font-body text-xs text-foreground-muted">
                  {statusLabel(edition.status)} · {edition.sectionCount} {edition.sectionCount === 1 ? "section" : "sections"} · {edition.total} {edition.total === 1 ? "story" : "stories"}
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-body text-sm">
                  {CONTENT_STATUSES.map((status) => (
                    <div key={status} className="flex justify-between">
                      <dt className="text-foreground-muted">{statusLabel(status)}</dt>
                      <dd className="font-semibold text-foreground">{edition.counts[status]}</dd>
                    </div>
                  ))}
                </dl>
                <Link href={`/admin/content?publication_id=${edition.id}`} className={`${linkClass} mt-3 inline-block`}>
                  View this edition&apos;s stories
                </Link>
              </div>
            ) : (
              <div className="px-4 py-4 font-body text-sm text-foreground-muted">
                No active edition is set. New stories will not be linked to an edition until one is chosen in{" "}
                <Link href="/admin/settings" className="text-primary-600 underline">
                  Site settings
                </Link>
                .
              </div>
            )}
          </Panel>

          {mine && (
            <Panel title="My work" action={<Link href="/admin/content?scope=mine" className={linkClass}>Open</Link>}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 font-body text-sm">
                {CONTENT_STATUSES.map((status) => (
                  <div key={status} className="flex justify-between">
                    <dt className="text-foreground-muted">
                      <Link href={`/admin/content?scope=mine&status=${status}`} className="hover:underline">
                        {statusLabel(status)}
                      </Link>
                    </dt>
                    <dd className="font-semibold text-foreground">{mine[status]}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel title="Recently updated" action={<Link href="/admin/content" className={linkClass}>All content</Link>}>
              {stats.recentContent.length === 0 ? (
                <p className="p-4 font-body text-sm text-foreground-muted">No stories yet.</p>
              ) : (
                stats.recentContent.map((item) => (
                  <StoryRow
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    sub={`${item.content_author?.name ?? "No author"} · ${formatContentDate(item.updated_at)}`}
                    right={<StatusBadge status={item.status} />}
                  />
                ))
              )}
            </Panel>

            <Panel title="Scheduled to publish">
              {stats.scheduledContent.length === 0 ? (
                <p className="p-4 font-body text-sm text-foreground-muted">Nothing is scheduled.</p>
              ) : (
                stats.scheduledContent.map((item) => (
                  <StoryRow
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    sub={item.content_author?.name ?? "No author"}
                    right={
                      <span className="font-medium text-foreground">
                        {item.publish_at ? new Date(item.publish_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No date"}
                      </span>
                    }
                  />
                ))
              )}
            </Panel>

            <Panel title="Drafts waiting longest">
              {stats.draftsNeedingAttention.length === 0 ? (
                <p className="p-4 font-body text-sm text-foreground-muted">No drafts.</p>
              ) : (
                stats.draftsNeedingAttention.map((item) => (
                  <StoryRow key={item.id} id={item.id} title={item.title} sub={item.content_author?.name ?? "No author"} right={`Edited ${formatContentDate(item.updated_at)}`} />
                ))
              )}
            </Panel>

            <Panel title="Recent activity" action={!isContributor ? <Link href="/admin/activity" className={linkClass}>View all</Link> : undefined}>
              <ActivityTable rows={stats.recentActivity} />
            </Panel>
          </div>
        </div>
      </div>
      {stats.total === 0 && (
        <div className="mt-6">
          <AdminEmptyState title="No stories yet">Create the first story to see it here.</AdminEmptyState>
        </div>
      )}
    </div>
  );
}
