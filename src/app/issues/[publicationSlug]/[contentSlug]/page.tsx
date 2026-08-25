import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicationBySlug, getContentByPublicationAndSlug } from "@/lib/content/queries";
import { getContentTypeConfig } from "@/content-types/registry";

type ContentPageParams = { publicationSlug: string; contentSlug: string };

/**
 * Shared by generateMetadata and the page body so a request only ever
 * fetches this content item once — React's cache() memoizes by argument
 * for the lifetime of a single request/render pass.
 */
const getPageData = cache(async (publicationSlug: string, contentSlug: string) => {
  const publication = await getPublicationBySlug(publicationSlug);
  if (!publication) return null;

  const content = await getContentByPublicationAndSlug(publication.id, contentSlug);
  if (!content) return null;

  return { publication, content };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<ContentPageParams>;
}): Promise<Metadata> {
  const { publicationSlug, contentSlug } = await params;
  const data = await getPageData(publicationSlug, contentSlug);
  if (!data) return {};

  const { content } = data;
  return {
    title: content.title,
    description: content.summary ?? undefined,
    openGraph: {
      title: content.title,
      description: content.summary ?? undefined,
      type: "article",
      publishedTime: content.publishedAt ?? undefined,
      authors: content.author ? [content.author.name] : undefined,
      images: content.coverImageUrl ? [{ url: content.coverImageUrl }] : undefined,
    },
  };
}

export default async function ContentPage({ params }: { params: Promise<ContentPageParams> }) {
  const { publicationSlug, contentSlug } = await params;

  const data = await getPageData(publicationSlug, contentSlug);
  if (!data) notFound();

  const { Template } = getContentTypeConfig(data.content.contentType);
  return <Template content={data.content} />;
}
