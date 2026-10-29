import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getEditionWorkspace } from "@/lib/admin/queries";
import { getAdminSession } from "@/lib/auth/session";
import { CONTENT_TYPE_LABELS } from "@/content-types/types";
import { AdminPageHeader, AdminEmptyState, StatusBadge } from "@/components/admin/ui";
import { EditionForm } from "@/components/admin/EditionForm";
import { MakeActiveEditionButton } from "@/components/admin/MakeActiveEditionButton";
import { DeleteEditionButton } from "@/components/admin/DeleteEditionButton";
import { formatContentDate } from "@/lib/content/format";

function Panel({ title, id, action, children }: { title: string; id?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={title} className="scroll-mt-4 border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-raised px-4 py-2">
        <h2 className="font-display text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function EditionWorkspacePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const page = Number((await searchParams).page ?? "1") || 1;
  const [data, session] = await Promise.all([getEditionWorkspace(id, page), getAdminSession()]);
  if (!data) notFound();

  const { edition, sections, unsectionedCount, stories, storyTotal, media } = data;
  const isAdmin = session?.role === "admin";
  const canEditEdition = session?.role !== "contributor";
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(storyTotal / pageSize));

  // Readiness is a plain reading of the live counts. It does not gate anything; publishing a story is still governed by the story's own checks.
  const checks = [
    { label: "Edition is published", ok: edition.status === "published", detail: edition.status === "published" ? "Public." : `Status is ${edition.status}. Stories in it are not publicly listed until the edition is published.` },
    { label: "No stories waiting for review", ok: edition.counts.review === 0, detail: edition.counts.review === 0 ? "Review queue is clear for this edition." : `${edition.counts.review} waiting.` },
    { label: "No drafts left behind", ok: edition.counts.draft === 0, detail: edition.counts.draft === 0 ? "None." : `${edition.counts.draft} still in draft.` },
    { label: "At least one published story", ok: edition.counts.published > 0, detail: `${edition.counts.published} published.` },
    { label: "Cover image chosen", ok: Boolean(edition.coverMediaId), detail: edition.coverMediaId ? "Set." : "Optional, but shown on the edition page." },
    { label: "Every story has a section", ok: unsectionedCount === 0, detail: unsectionedCount === 0 ? "Yes." : `${unsectionedCount} without a section.` },
  ];

  return (
    <div>
      <p className="mb-2 font-body text-sm">
        <Link href="/admin/publications" className="text-primary-600 underline underline-offset-2">
          Editions
        </Link>
      </p>
      <AdminPageHeader
        title={edition.title}
        description={`/${edition.slug}${edition.publishedAt ? ` · published ${formatContentDate(edition.publishedAt)}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {edition.isActive && <span className="border border-primary-500 bg-secondary-400 px-2 py-1 font-body text-xs font-bold text-primary-900">Active edition</span>}
            <StatusBadge status={edition.status} />
            <Link href={`/admin/content/new`} className="border border-secondary-400 bg-secondary-400 px-4 py-2 font-body text-sm font-medium text-primary-900 hover:bg-secondary-300">
              New story
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Stories", value: edition.total },
              { label: "Published", value: edition.counts.published },
              { label: "In review", value: edition.counts.review },
              { label: "Scheduled", value: edition.counts.scheduled },
              { label: "Drafts", value: edition.counts.draft },
            ].map((tile) => (
              <li key={tile.label} className="border border-border border-t-[3px] border-t-primary-500 bg-surface px-4 py-2">
                <p className="font-display text-2xl font-semibold text-foreground">{tile.value}</p>
                <p className="font-body text-xs text-foreground-muted">{tile.label}</p>
              </li>
            ))}
          </ul>

          <Panel
            title="Stories in this edition"
            action={
              <Link href={`/admin/content?publication_id=${edition.id}`} className="font-body text-xs font-medium text-primary-600 underline underline-offset-2">
                Open in content list
              </Link>
            }
          >
            {stories.length === 0 ? (
              <div className="p-4">
                <AdminEmptyState title="No stories in this edition yet">Choose this edition when writing a story. Creating an edition never moves existing stories.</AdminEmptyState>
              </div>
            ) : (
              <ul>
                {stories.map((story) => (
                  <li key={story.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_9rem_8rem]">
                    <div className="min-w-0">
                      <Link href={`/admin/content/${story.id}`} className="block truncate font-body text-sm font-semibold text-foreground hover:text-primary-600 hover:underline">
                        {story.title}
                      </Link>
                      <p className="truncate font-body text-xs text-foreground-muted">
                        {CONTENT_TYPE_LABELS[story.content_type]} · {story.content_author?.name ?? "No author"} · {story.content_section?.title ?? "No section"}
                      </p>
                    </div>
                    <div>
                      <StatusBadge status={story.status} />
                    </div>
                    <span className="font-body text-xs text-foreground-muted">{formatContentDate(story.updated_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center gap-3 border-t border-border px-4 py-2 font-body text-sm text-foreground-muted">
                <span>
                  Page {page} of {totalPages}
                </span>
                {page > 1 && (
                  <Link href={`?page=${page - 1}`} className="border border-border bg-surface px-3 py-1 text-foreground hover:border-border-strong">
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`?page=${page + 1}`} className="border border-border bg-surface px-3 py-1 text-foreground hover:border-border-strong">
                    Next
                  </Link>
                )}
              </nav>
            )}
          </Panel>

          <Panel
            title="Sections"
            action={
              <Link href={`/admin/sections?publication_id=${edition.id}`} className="font-body text-xs font-medium text-primary-600 underline underline-offset-2">
                Manage sections
              </Link>
            }
          >
            {sections.length === 0 ? (
              <p className="p-4 font-body text-sm text-foreground-muted">This edition has no sections yet. Sections group stories on the edition page.</p>
            ) : (
              <ol className="divide-y divide-border">
                {sections.map((section, index) => (
                  <li key={section.id} className="flex items-center justify-between gap-3 px-4 py-2 font-body text-sm">
                    <span className="text-foreground">
                      <span className="mr-2 text-foreground-muted">{index + 1}.</span>
                      {section.title}
                    </span>
                    <span className="text-foreground-muted">
                      {section.storyCount} {section.storyCount === 1 ? "story" : "stories"}
                    </span>
                  </li>
                ))}
                {unsectionedCount > 0 && (
                  <li className="flex items-center justify-between gap-3 px-4 py-2 font-body text-sm text-foreground-muted">
                    <span>No section</span>
                    <span>{unsectionedCount}</span>
                  </li>
                )}
              </ol>
            )}
          </Panel>

          <Panel title="Media used in this edition" id="media" action={<Link href="/admin/media" className="font-body text-xs font-medium text-primary-600 underline underline-offset-2">Media library</Link>}>
            {media.length === 0 ? (
              <p className="p-4 font-body text-sm text-foreground-muted">No images are used by this edition&apos;s stories yet.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 md:grid-cols-6">
                {media.map((item) => (
                  <li key={item.id} className="border border-border">
                    <div className="relative aspect-square bg-surface-raised">
                      {item.url ? (
                        <Image src={item.url} alt={item.alt_text ?? ""} fill sizes="120px" className="object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center font-body text-[11px] text-foreground-muted">Private</span>
                      )}
                    </div>
                    <p className="truncate px-1.5 py-1 font-body text-[11px] text-foreground" title={item.original_filename ?? undefined}>
                      {item.original_filename ?? "image"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <Panel title="Publication readiness">
            <ul className="space-y-2 p-4">
              {checks.map((check) => (
                <li key={check.label} className="flex gap-2 font-body text-sm">
                  <span aria-hidden="true" className="w-4 font-bold text-foreground">{check.ok ? "✓" : "✗"}</span>
                  <span className="text-foreground">
                    <span className="sr-only">{check.ok ? "Done: " : "Not done: "}</span>
                    {check.label}
                    <span className="block font-body text-xs text-foreground-muted">{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {edition.counts.review > 0 && (
              <div className="border-t border-border px-4 py-3">
                <Link href="/admin/review" className="font-body text-sm font-medium text-primary-600 underline underline-offset-2">
                  Open the review queue ({edition.counts.review})
                </Link>
              </div>
            )}
          </Panel>

          <Panel title="Active edition">
            <div className="space-y-2 p-4 font-body text-sm text-foreground">
              {edition.isActive ? (
                <p>This is the active edition. New stories are pre-assigned to it.</p>
              ) : isAdmin ? (
                <>
                  <p className="text-foreground-muted">New stories are pre-assigned to the active edition. Changing it does not move any existing story.</p>
                  <MakeActiveEditionButton editionId={edition.id} editionTitle={edition.title} />
                </>
              ) : (
                <p className="text-foreground-muted">Only an administrator can change the active edition.</p>
              )}
            </div>
          </Panel>

          {canEditEdition && (
            <Panel title="Edition details">
              <div className="p-0">
                <EditionForm
                  compact
                  initial={{
                    id: edition.id,
                    title: edition.title,
                    slug: edition.slug,
                    subtitle: edition.subtitle,
                    status: edition.status,
                    cover: edition.coverMediaId ? { id: edition.coverMediaId, url: edition.coverUrl, alt_text: edition.coverAltText } : null,
                  }}
                />
              </div>
              {/* Same visibility as before the redesign: anyone who can edit the edition. RLS still decides whether the delete succeeds. */}
              {canEditEdition && (
                <div className="border-t border-border p-4">
                  <p className="mb-2 font-body text-xs text-foreground-muted">Deleting an edition cannot be undone.</p>
                  <DeleteEditionButton editionId={edition.id} />
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
