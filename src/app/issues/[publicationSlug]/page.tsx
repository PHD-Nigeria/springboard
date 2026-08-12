import { notFound } from "next/navigation";
import { Hero } from "@/components/editorial/Hero";
import { EditorialSection } from "@/components/editorial/EditorialSection";
import {
  getPublicationBySlug,
  getSectionsForPublication,
  getContentForSection,
} from "@/lib/content/queries";

export default async function PublicationPage({
  params,
}: {
  params: Promise<{ publicationSlug: string }>;
}) {
  const { publicationSlug } = await params;
  const publication = await getPublicationBySlug(publicationSlug);
  if (!publication) notFound();

  const sections = await getSectionsForPublication(publication.id);
  const sectionsWithContent = await Promise.all(
    sections.map(async (section) => ({
      section,
      items: await getContentForSection(section.id),
    }))
  );

  return (
    <>
      <Hero title={publication.title} subtitle={publication.subtitle} />
      {sectionsWithContent.map(({ section, items }) => (
        <EditorialSection key={section.id} title={section.title} items={items} />
      ))}
    </>
  );
}
