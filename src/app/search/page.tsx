import type { Metadata } from "next";
import { searchContent } from "@/lib/content/queries";
import { ArticleCard } from "@/components/editorial/ArticleCard";
import { Search } from "@/components/search/Search";

type SearchPageParams = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: SearchPageParams): Promise<Metadata> {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  return {
    title: query ? `Search results for "${query}"` : "Search",
    description: "Find insights, stories, people, and news from across PHD Nigeria.",
    // A specific query's results page is thin, user-generated, effectively
    // unbounded in URL-space, and duplicates content indexable elsewhere —
    // standard practice is to keep only the bare /search page indexable.
    robots: query ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({ searchParams }: SearchPageParams) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await searchContent(query, 20) : [];

  return (
    <main>
      <section className="mx-auto max-w-6xl px-gutter pt-14 pb-section-md md:pt-20">
        <p className="mb-4 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Search</p>
        <h1 className="max-w-3xl font-display text-5xl leading-[1.05] font-medium text-foreground md:text-7xl">
          Search Springboard
        </h1>
        <p className="mt-6 max-w-xl font-body text-lg leading-relaxed text-foreground-muted">
          Find insights, stories, people, and news from across PHD Nigeria.
        </p>

        <div className="mt-10 max-w-2xl">
          <Search initialQuery={query} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-gutter pb-section-lg">
        {!query && (
          <div className="max-w-xl border-t border-border pt-10">
            <h2 className="font-display text-2xl font-medium text-foreground md:text-3xl">Explore Springboard</h2>
            <p className="mt-3 font-body text-base leading-relaxed text-foreground-muted">
              Search for an insight, story, person, or news update.
            </p>
          </div>
        )}

        {query && results.length === 0 && (
          <div className="max-w-xl border-t border-border pt-10">
            <p className="mb-2 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
              Search Results
            </p>
            <h2 className="font-display text-2xl font-medium text-foreground md:text-3xl">No results found</h2>
            <p className="mt-3 font-body text-base leading-relaxed text-foreground-muted">Try another search term.</p>
          </div>
        )}

        {query && results.length > 0 && (
          <>
            <div className="mb-10 border-t border-border pt-10">
              <p className="mb-2 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
                Search Results
              </p>
              <h2 className="font-display text-2xl font-medium text-foreground md:text-3xl">
                Results for &ldquo;{query}&rdquo;
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-2">
              {results.map((item) => (
                <ArticleCard key={item.id} content={item} sizes="(min-width: 1024px) 50vw, 100vw" />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
