import { notFound } from "next/navigation";
import { getPublicationBySlug, getContentByPublicationAndSlug } from "@/lib/content/queries";
import { getContentTypeConfig } from "@/content-types/registry";

export default async function ContentPage({
  params,
}: {
  params: Promise<{ publicationSlug: string; contentSlug: string }>;
}) {
  const { publicationSlug, contentSlug } = await params;

  const publication = await getPublicationBySlug(publicationSlug);
  if (!publication) notFound();

  const content = await getContentByPublicationAndSlug(publication.id, contentSlug);
  if (!content) notFound();

  const { Template } = getContentTypeConfig(content.contentType);
  return <Template content={content} />;
}
