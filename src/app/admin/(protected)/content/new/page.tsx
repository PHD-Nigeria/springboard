import { listAuthors, listCategories, listPublications, listSections, getSiteSettings } from "@/lib/admin/queries";
import { ContentForm } from "@/components/admin/ContentForm";
import { AdminPageHeader } from "@/components/admin/ui";

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
      <AdminPageHeader title="New content" />
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
