import type { MetadataRoute } from "next";

/**
 * Next.js file-convention robots.txt. `/admin` is disallowed here as a
 * courtesy to well-behaved crawlers — it is NOT the security boundary
 * (RLS/session auth is, same as everywhere else in this app); a robots.txt
 * disallow rule doesn't stop a request, it just asks crawlers not to make
 * one. `/api` is disallowed for the same reason (the cron route is already
 * bearer-token gated regardless).
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: siteUrl ? `${siteUrl.replace(/\/$/, "")}/sitemap.xml` : undefined,
  };
}
