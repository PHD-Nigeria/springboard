import { getRecentContent, getFeaturedContributors, getNewsBites, getPublicSiteSettings, getContentById, getAuthorsByIds, getActiveEdition, getHomeVideos, pickFeaturedVideo } from "@/lib/content/queries";
import "@/components/home/home-theme.css";
import { FeaturedVideoPanel } from "@/components/home/FeaturedVideoPanel";
import { EditionPanel } from "@/components/home/EditionPanel";
import { getContentTypeConfig } from "@/content-types/registry";
import { FeaturedStory } from "@/components/editorial/FeaturedStory";
import { NewsCard } from "@/components/editorial/NewsCard";
import { EditorialBanner } from "@/components/editorial/EditorialBanner";
import { ContributorCard } from "@/components/editorial/ContributorCard";

export default async function Home() {
  const [recent, contributors, newsBites, settings, edition, allVideos] = await Promise.all([
    getRecentContent(9),
    getFeaturedContributors(4),
    getNewsBites(6),
    getPublicSiteSettings(),
    getActiveEdition(),
    getHomeVideos(),
  ]);

  // Lead video: HR-style selection is data, not code. Once the featured-video
  // setting exists (proposed M4, not applied) its id is passed as the third
  // argument; until then the newest video in the active edition leads, and
  // every other published video stays selectable. Active edition first so
  // switching quarters never hides older videos, only re-orders them.
  const lead = pickFeaturedVideo(allVideos, edition?.slug ?? null);
  const videos = lead ? [lead, ...allVideos.filter((v) => v.videoId !== lead.videoId)] : [];

  // Homepage editorial configuration (§12, Phase 4F): the CMS picks WHICH
  // story leads and WHICH people appear — FeaturedStory/ContributorCard
  // still control HOW. An admin's pick that's since been unpublished (or
  // was never publicly visible to begin with) resolves to null here —
  // getContentById runs through the same RLS every public query does, so
  // this fails closed, not open — and the recency-based fallback below
  // covers it exactly as if nothing had ever been picked.
  const pickedFeatured = settings.featuredContentId ? await getContentById(settings.featuredContentId) : null;
  const featured = pickedFeatured ?? recent[0];
  const rest = featured ? recent.filter((item) => item.id !== featured.id) : recent;
  const editionStories = edition ? rest.filter((item) => item.publicationId === edition.id) : [];
  const recentSidebar = (editionStories.length > 0 ? editionStories : rest).slice(0, 4);
  const moreStories = rest.slice(4, 7);

  const pickedContributors = settings.featuredAuthorIds.length > 0 ? await getAuthorsByIds(settings.featuredAuthorIds) : [];
  const displayedContributors = pickedContributors.length > 0 ? pickedContributors : contributors;

  return (
    <main className="home-theme bg-background text-foreground">
      {/* Every other page type (article/news/publication via Hero,
          contributor, search) already has exactly one <h1> — the homepage
          alone had none, since it leads with FeaturedStory's own <h2> (that
          component is also nested repeatedly inside EditorialSection on the
          publication page, so promoting ITS heading to h1 would create
          duplicates there instead). A visually-hidden h1 gives screen
          readers/SEO the missing landmark with zero visual change. */}
      <h1 className="sr-only">{settings.siteTitle ?? "Springboard — PHD Nigeria's editorial platform"}</h1>
      {videos.length > 0 ? (
        <section aria-label="Featured video and latest edition" className="mx-auto max-w-6xl px-gutter pt-8 pb-section-md md:pt-10">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <FeaturedVideoPanel videos={videos} />
            {edition ? (
              <EditionPanel edition={edition} stories={recentSidebar} />
            ) : (
              recentSidebar.length > 0 && (
                <aside>
                  <h2 className="mb-2 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">Recent Stories</h2>
                  <div className="divide-y divide-border">
                    {recentSidebar.map((item) => (
                      <NewsCard key={item.id} content={item} />
                    ))}
                  </div>
                </aside>
              )
            )}
          </div>
        </section>
      ) : null}

      {featured ? (
        <section className="mx-auto max-w-6xl px-gutter pt-10 pb-section-lg md:pt-12">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_360px]">
            <FeaturedStory content={featured} />

            {videos.length === 0 && recentSidebar.length > 0 && (
              <aside>
                <h2 className="mb-2 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
                  Recent Stories
                </h2>
                <div className="divide-y divide-border">
                  {recentSidebar.map((item) => (
                    <NewsCard key={item.id} content={item} />
                  ))}
                </div>
              </aside>
            )}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-6xl px-gutter py-section-lg text-center">
          <p className="font-body text-sm text-foreground-muted">
            No published content yet — this page is fully data-driven and will populate automatically once
            Supabase has published content.
          </p>
        </section>
      )}

      <EditorialBanner
        eyebrow="Springboard"
        title={settings.bannerTitle ?? "Where PHD Nigeria’s people, ideas, and culture come together."}
        description={settings.bannerDescription ?? "A space for the stories, insights, and voices that shape how we work."}
      />

      {moreStories.length > 0 && (
        <section id="more-stories" className="mx-auto max-w-6xl px-gutter py-section-md">
          <h2 className="mb-10 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
            More Stories
          </h2>
          <div className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
            {moreStories.map((item) => {
              const { Card } = getContentTypeConfig(item.contentType);
              return <Card key={item.id} content={item} />;
            })}
          </div>
        </section>
      )}

      {displayedContributors.length > 0 && (
        <section id="people" className="mx-auto max-w-6xl px-gutter py-section-md">
          <h2 className="mb-10 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
            People
          </h2>
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            {displayedContributors.map((author) => (
              <ContributorCard key={author.id} author={author} />
            ))}
          </div>
        </section>
      )}

      {newsBites.length > 0 && (
        <section id="news-bites" className="mx-auto max-w-6xl px-gutter py-section-md">
          <h2 className="mb-2 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
            News Bites
          </h2>
          <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
            <div className="divide-y divide-border md:border-r md:border-border md:pr-10">
              {newsBites.slice(0, 3).map((item) => (
                <NewsCard key={item.id} content={item} />
              ))}
            </div>
            <div className="divide-y divide-border md:pl-10">
              {newsBites.slice(3, 6).map((item) => (
                <NewsCard key={item.id} content={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
