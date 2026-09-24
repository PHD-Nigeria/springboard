import Link from "next/link";
import { listAuthors, listCategories, listPublications, listSections, getSiteSettings } from "@/lib/admin/queries";
import { ContentForm } from "@/components/admin/ContentForm";
import { AdminPageHeader } from "@/components/admin/ui";

/** What am I creating? (§4): a spotlight or a birthday has its own dedicated builder (real staff data, not a written body), everything else shares the one form below with a "Content type" dropdown. */
function CreationChoice({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="block border border-border p-4 hover:border-secondary-400">
      <p className="font-body text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 font-body text-xs text-foreground-muted">{description}</p>
    </Link>
  );
}

export default async function NewContentPage() {
  const [authors, categories, publications, sections, settings] = await Promise.all([
    listAuthors(),
    listCategories(),
    listPublications(),
    listSections(),
    getSiteSettings(),
  ]);

  return (
    <div>
      <AdminPageHeader title="New content" description="What are you creating?" />

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CreationChoice
          href="/admin/content/new/spotlight"
          title="Staff Spotlight"
          description="Profile one staff member with a photo and Q&A."
        />
        <CreationChoice
          href="/admin/content/new/birthday"
          title="Staff News / Birthday"
          description="One card for one person's birthday."
        />
        <CreationChoice
          href="/admin/staff/new"
          title="Add a staff member first"
          description="Needed before a Spotlight or Birthday can reference them."
        />
      </div>

      <p className="mb-4 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
        Or: Article, Company News, Healthline, Photos of the Quarter (gallery)
      </p>
      <ContentForm
        content={null}
        authors={authors.map((a) => ({ id: a.id, label: a.name }))}
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        publications={publications.map((p) => ({ id: p.id, label: p.title }))}
        sections={sections.map((s) => ({ id: s.id, label: s.title, publicationId: s.publication_id }))}
        initialMediaById={{}}
        initialCover={null}
        defaultPublicationId={settings.defaultPublicationId}
      />
    </div>
  );
}
