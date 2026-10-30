import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hero } from "@/components/editorial/Hero";
import { isVideoOnly } from "@/lib/content/home-helpers";
import { EditorialSection } from "@/components/editorial/EditorialSection";
import {
  getPublicationBySlug,
  getSectionsForPublication,
  getContentForSection,
  getUnsectionedContentForPublication,
} from "@/lib/content/queries";

type PublicationPageParams = { publicationSlug: string };

// Shared with generateMetadata — see the content page's identical pattern.
const getPublication = cache((publicationSlug: string) => getPublicationBySlug(publicationSlug));

export async function generateMetadata({
  params,
}: {
  params: Promise<PublicationPageParams>;
}): Promise<Metadata> {
  const { publicationSlug } = await params;
  const publication = await getPublication(publicationSlug);
  if (!publication) return {};

  return {
    title: publication.title,
    description: publication.subtitle ?? undefined,
    openGraph: {
      title: publication.title,
      description: publication.subtitle ?? undefined,
      type: "website",
      images: publication.coverImageUrl ? [{ url: publication.coverImageUrl }] : undefined,
    },
  };
}

export default async function PublicationPage({
  params,
}: {
  params: Promise<PublicationPageParams>;
}) {
  const { publicationSlug } = await params;
  const publication = await getPublication(publicationSlug);
  if (!publication) notFound();

  const sections = await getSectionsForPublication(publication.id);
  const sectionsWithContent = await Promise.all(
    sections.map(async (section) => ({
      section,
      items: await getContentForSection(section.id),
    }))
  );
  const hasAnyContent = sectionsWithContent.some(({ items }) => items.length > 0);
  // An edition with no sections (or with stories that sit in none) still lists its published stories rather than claiming it has none.
  const unsectioned = (await getUnsectionedContentForPublication(publication.id)).filter((item) => !isVideoOnly(item));

  return (
    <>
      <Hero
        title={publication.title}
        subtitle={publication.subtitle}
        imageUrl={publication.coverImageUrl}
        imageAlt={publication.title}
        fallbackSeed={publication.id}
      />
      {hasAnyContent || unsectioned.length > 0 ? (
        <>
          {sectionsWithContent.map(({ section, items }) => (
            <EditorialSection key={section.id} title={section.title} items={items} />
          ))}
          {unsectioned.length > 0 && <EditorialSection title={hasAnyContent ? "More from this edition" : "Stories in this edition"} items={unsectioned} />}
        </>
      ) : (
        <section className="mx-auto max-w-6xl px-gutter py-section-lg text-center">
          <p className="font-body text-sm text-foreground-muted">
            No stories have been published in this issue yet.
          </p>
        </section>
      )}
    </>
  );
}
