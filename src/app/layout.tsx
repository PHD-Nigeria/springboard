import type { Metadata } from "next";
import { Syne } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/motion/PageTransition";
import { getPublicSiteSettings, getPublicNavItems } from "@/lib/content/queries";

// Self-hosted via next/font — no runtime request to Google, no layout shift.
// Syne is the sole typeface per the authoritative PHD brand spec (2026-08-14)
// — deliberately no second body/UI face: Syne reads fine at UI sizes and the
// brief was explicit about not reintroducing Inter/Fraunces/Montserrat/
// Georgia as a substitute. If long-form article body copy ever needs a more
// restrained reading face, that's a follow-up decision, not something to
// invent here. The generated --font-syne variable feeds both
// --font-display/--font-body in theme.css, so components only ever reach
// for those semantic tokens, never this variable directly.
const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

// metadataBase resolves relative OG/Twitter image URLs (and canonical URLs)
// to an absolute one — there's no production domain configured yet
// (NEXT_PUBLIC_SITE_URL is unset in .env.local.example), so this is
// undefined until that's supplied; Next falls back to inferring it from the
// deployment URL in the meantime rather than a hard failure.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

const SITE_TITLE = "Springboard | PHD Nigeria";
const SITE_DESCRIPTION = "PHD Nigeria Springboard — digital editorial platform.";

// A DB-driven default (site_title/seo_default_description/og_image, all
// configurable at /admin/settings, §14 Phase 4F) means this can no longer
// be a static `export const metadata` — Next only allows one or the other.
// Every value below still has the exact same hardcoded fallback as before,
// so an admin never touching these settings changes nothing.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  const title = settings.siteTitle ?? SITE_TITLE;
  const description = settings.seoDefaultDescription ?? SITE_DESCRIPTION;

  return {
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    title: {
      default: title,
      // Lets every other page set just its own short title (e.g. via
      // generateMetadata) and get the "| Springboard" suffix for free,
      // rather than every route re-composing the full string itself.
      template: "%s | Springboard",
    },
    description,
    openGraph: {
      title,
      description,
      siteName: "Springboard",
      type: "website",
      images: settings.ogImageUrl ? [{ url: settings.ogImageUrl }] : undefined,
    },
    icons: settings.faviconUrl ? { icon: settings.faviconUrl } : undefined,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const navItems = await getPublicNavItems();

  return (
    <html lang="en" className={syne.variable}>
      <body className="bg-background font-body text-foreground antialiased">
        <Navigation items={navItems} />
        <PageTransition>{children}</PageTransition>
        <Footer />
      </body>
    </html>
  );
}
