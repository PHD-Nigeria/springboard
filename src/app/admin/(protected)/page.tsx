import Link from "next/link";
import { getDashboardStats } from "@/lib/admin/queries";
import { AdminCard, AdminPageHeader, StatusBadge } from "@/components/admin/ui";
import { ActivityTable } from "@/components/admin/ActivityTable";
import { formatContentDate } from "@/lib/content/format";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const statTiles = [
    { label: "Total content", value: stats.total },
    { label: "Published", value: stats.counts.published },
    { label: "Drafts", value: stats.counts.draft },
    { label: "In review", value: stats.counts.review },
    { label: "Scheduled", value: stats.counts.scheduled },
    { label: "Archived", value: stats.counts.archived },
    { label: "Contributors", value: stats.contributorsCount },
    { label: "Media assets", value: stats.mediaAssetsCount },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="An operational snapshot of Springboard's editorial content."
        actions={
          <Link href="/admin/content/new" className="border border-secondary-400 bg-secondary-400 px-4 py-2 font-body text-sm font-medium text-primary-900 hover:bg-secondary-300">
            New content
          </Link>
        }
      />

      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {statTiles.map((tile) => (
          <AdminCard key={tile.label} className="text-center">
            <p className="font-display text-3xl font-medium text-foreground">{tile.value}</p>
            <p className="mt-1 font-body text-xs tracking-wide text-foreground-muted uppercase">{tile.label}</p>
          </AdminCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
            Recently updated content
          </h2>
          <div className="border border-border">
            {stats.recentContent.length === 0 ? (
              <p className="p-6 font-body text-sm text-foreground-muted">No content yet.</p>
            ) : (
              stats.recentContent.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/content/${item.id}`}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0 hover:bg-background"
                >
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm text-foreground">{item.title}</p>
                    <p className="font-body text-xs text-foreground-muted">
                      {item.content_type} · {item.content_author?.name ?? "No author"}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-4 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
            Scheduled publishing
          </h2>
          <div className="border border-border">
            {stats.scheduledContent.length === 0 ? (
              <p className="p-6 font-body text-sm text-foreground-muted">Nothing scheduled.</p>
            ) : (
              stats.scheduledContent.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/content/${item.id}`}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0 hover:bg-background"
                >
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm text-foreground">{item.title}</p>
                    <p className="font-body text-xs text-foreground-muted">{item.content_author?.name ?? "No author"}</p>
                  </div>
                  <p className="shrink-0 font-body text-xs text-coral">
                    {item.publish_at
                      ? new Date(item.publish_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-4 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
            Drafts needing attention
          </h2>
          <div className="border border-border">
            {stats.draftsNeedingAttention.length === 0 ? (
              <p className="p-6 font-body text-sm text-foreground-muted">No stale drafts.</p>
            ) : (
              stats.draftsNeedingAttention.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/content/${item.id}`}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0 hover:bg-background"
                >
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm text-foreground">{item.title}</p>
                    <p className="font-body text-xs text-foreground-muted">{item.content_author?.name ?? "No author"}</p>
                  </div>
                  <p className="shrink-0 font-body text-xs text-foreground-muted">Last edited {formatContentDate(item.updated_at)}</p>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Recent activity</h2>
            <Link href="/admin/activity" className="font-body text-xs text-foreground-muted hover:text-secondary-400">
              View all →
            </Link>
          </div>
          <ActivityTable rows={stats.recentActivity} />
        </div>
      </div>
    </div>
  );
}
