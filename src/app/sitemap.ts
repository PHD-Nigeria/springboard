import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/content/queries";

/**
 * Next.js file-convention sitemap (build/request-time, not a static file).
 * Every URL comes from getSitemapEntries(), which reads through the same
 * RLS-scoped client every public page uses — draft/scheduled-in-the-future/
 * archived content is excluded by the same RLS that keeps it off the public
 * site itself, not a second filter here that could drift out of sync.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  // No production domain configured yet — an empty sitemap is safer than
  // guessing a host, and this file simply won't be requested until deploy.
  if (!siteUrl) return [];

  const base = siteUrl.replace(/\/$/, "");
  const { publications, content, authors } = await getSitemapEntries();

  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // The grouped-navigation landing pages (§1 of the Q2 '26 editorial
  // upgrade) — static routes, not derived from any query, so they're listed
  // directly rather than through getSitemapEntries().
  const categoryLandingSlugs = [
    "company-news",
    "articles",
    "staff-spotlight",
    "staff-news",
    "hr-corner",
    "healthline",
    "photos-of-the-quarter",
    "games",
  ];
  for (const slug of categoryLandingSlugs) {
    entries.push({ url: `${base}/${slug}`, changeFrequency: "weekly", priority: 0.6 });
  }

  for (const publication of publications) {
    entries.push({
      url: `${base}/issues/${publication.slug}`,
      lastModified: publication.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const item of content) {
    entries.push({
      url: `${base}/issues/${item.publicationSlug}/${item.contentSlug}`,
      lastModified: item.updatedAt,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const author of authors) {
    entries.push({
      url: `${base}/contributors/${author.slug}`,
      lastModified: author.updatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}
