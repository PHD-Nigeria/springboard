import { listSections, listPublications } from "@/lib/admin/queries";
import { SectionManager } from "@/components/admin/SectionManager";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function AdminSectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ publication_id?: string }>;
}) {
  const { publication_id: publicationId } = await searchParams;
  const [sections, publications] = await Promise.all([listSections(publicationId), listPublications()]);

  return (
    <div>
      <AdminPageHeader title="Sections" description="Groupings of content within a publication." />
      <SectionManager
        initialSections={sections}
        publications={publications.map((p) => ({ id: p.id, title: p.title }))}
      />
    </div>
  );
}
