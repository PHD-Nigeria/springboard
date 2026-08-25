import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorBySlug, getContentByAuthor } from "@/lib/content/queries";
import { ContributorImageReveal } from "@/components/motion/ContributorImageReveal";
import { ArticleCard } from "@/components/editorial/ArticleCard";

type ContributorPageParams = { authorSlug: string };

// Shared with generateMetadata — see the content page's identical pattern.
const getAuthor = cache((authorSlug: string) => getAuthorBySlug(authorSlug));

export async function generateMetadata({
  params,
}: {
  params: Promise<ContributorPageParams>;
}): Promise<Metadata> {
  const { authorSlug } = await params;
  const author = await getAuthor(authorSlug);
  if (!author) return {};

  const description = author.bio ?? (author.title ? `${author.title} at PHD Nigeria` : "PHD Nigeria");
  return {
    title: author.name,
    description,
    openGraph: {
      title: author.name,
      description,
      type: "profile",
      images: author.avatarUrl ? [{ url: author.avatarUrl }] : undefined,
    },
  };
}

export default async function ContributorPage({
  params,
}: {
  params: Promise<ContributorPageParams>;
}) {
  const { authorSlug } = await params;

  const author = await getAuthor(authorSlug);
  if (!author) notFound();

  const articles = await getContentByAuthor(author.id, { limit: 12 });

  return (
    <article>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-gutter pt-24 pb-section-md md:grid-cols-[380px_1fr] md:items-center">
        <ContributorImageReveal
          src={author.avatarUrl}
          alt={author.name}
          aspectClassName="aspect-[4/5] w-full"
          priority
        />

        <div>
          <h1 className="font-display text-5xl font-medium text-foreground md:text-6xl">{author.name}</h1>
          <p className="mt-4 font-body text-base text-foreground-muted">
            {author.title ? `${author.title} · ` : ""}PHD Nigeria
          </p>
          {author.bio && (
            <p className="mt-6 max-w-xl font-body text-lg leading-relaxed text-foreground">{author.bio}</p>
          )}
        </div>
      </div>

      {articles.length > 0 && (
        <section className="mx-auto max-w-6xl px-gutter py-section-md">
          <h2 className="mb-10 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
            Stories by {author.name}
          </h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
            {articles.map((item) => (
              <ArticleCard key={item.id} content={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
