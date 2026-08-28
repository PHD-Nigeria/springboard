import "./guide.css";
import { listGuideChapters } from "@/lib/guide/content";
import { buildGuideSearchIndex } from "@/lib/guide/search";
import { GuideSidebar } from "@/components/guide/GuideSidebar";
import { GuideLightbox } from "@/components/guide/GuideLightbox";

/**
 * Shell shared by every /admin/guide route: the sidebar (chapters + search)
 * and the lightbox live here once, rather than in each page, so navigating
 * between chapters never remounts them. Everything read here comes
 * straight from docs/user-guide/ (see src/lib/guide/content.ts) — this
 * file holds no chapter titles or content of its own.
 */
export default async function GuideLayout({ children }: { children: React.ReactNode }) {
  const [chapters, searchDocuments] = await Promise.all([listGuideChapters(), buildGuideSearchIndex()]);

  return (
    <div>
      <div className="mb-8 border-b border-border pb-4">
        <p className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Admin</p>
        <h1 className="mt-1 font-display text-2xl font-medium text-foreground">Springboard User Guide</h1>
        <p className="mt-1 font-body text-sm text-foreground-muted">
          Read-only reference for using the Springboard Admin — rendered from the approved guide in the repository.
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <GuideSidebar chapters={chapters} searchDocuments={searchDocuments} />
        <GuideLightbox className="min-w-0 flex-1">{children}</GuideLightbox>
      </div>
    </div>
  );
}
