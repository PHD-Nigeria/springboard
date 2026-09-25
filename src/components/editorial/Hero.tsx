"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { duration, easing } from "@/design-system/tokens/motion";
import { getTaxonomyColorClass } from "@/design-system/tokens/colors";
import { MediaFallback } from "@/components/editorial/MediaFallback";

interface HeroProps {
  title: string;
  subtitle?: string | null;
  category?: { name: string; slug: string } | null;
  imageUrl?: string | null;
  imageAlt?: string;
  /** Used to seed the branded fallback when imageUrl is missing — should be stable per article (e.g. content id). */
  fallbackSeed?: string;
  /** Byline/date or other small metadata, rendered under the title. */
  meta?: ReactNode;
}

/** Page-top masthead — used by ArticleTemplate. A one-time reveal on mount, not a scroll trigger. */
export function Hero({ title, subtitle, category, imageUrl, imageAlt, fallbackSeed, meta }: HeroProps) {
  const reduceMotion = useReducedMotion();

  return (
    <header className="pt-24 pb-14 text-center">
      <motion.div
        className="mx-auto max-w-3xl px-gutter"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.hero, ease: easing.editorialIn }}
      >
        {category && (
          <p
            className={`mb-5 font-body text-xs font-medium tracking-wide uppercase ${getTaxonomyColorClass(category.slug)}`}
          >
            {category.name}
          </p>
        )}

        <h1 className="font-display text-5xl leading-[1.05] font-medium text-foreground md:text-7xl">
          {title}
        </h1>

        {subtitle && (
          <p className="mx-auto mt-6 max-w-2xl font-body text-lg leading-relaxed text-foreground-muted">
            {subtitle}
          </p>
        )}

        {meta && <div className="mt-6 font-body text-sm text-foreground-muted">{meta}</div>}
      </motion.div>

      <div className="mx-auto mt-12 max-w-6xl px-gutter">
        <motion.div
          // aspect-[16/9] stays: next/image's `fill` mode needs a box with a
          // real height (it fills its positioned ancestor, an absolutely
          // positioned child can't contribute height to that ancestor
          // itself), and this codebase never records an uploaded image's
          // real width/height (see media-actions.ts, every upload path
          // writes width/height as null — no image-decoding library on the
          // server), so there's no intrinsic ratio available to size a box
          // from. What changes below is object-fit: `cover` crops to fill
          // this box regardless of the source photo's own shape, which is
          // what was cutting portrait photos off at the neck; `contain`
          // scales the whole photo to fit inside the box instead, letting a
          // portrait stay visibly portrait (letterboxed, not cropped) and a
          // landscape still fill the box edge-to-edge as before.
          className="relative aspect-[16/9] overflow-hidden bg-surface"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.hero, ease: easing.editorialIn, delay: reduceMotion ? 0 : 0.15 }}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? title}
              fill
              priority
              // Matches this container's real rendered width (max-w-6xl,
              // 1152px) instead of a blanket 100vw, which was asking the
              // browser to fetch a full-viewport-width source on any screen
              // wider than that — the wrong direction for "appropriate
              // resolution," it wasn't picking something too small, it was
              // over-fetching on wide desktops while a mid-size viewport
              // still got a proportionally scaled-down source either way.
              sizes="(min-width: 1152px) 1152px, 100vw"
              className="object-contain"
            />
          ) : (
            <MediaFallback seed={fallbackSeed ?? title} />
          )}
        </motion.div>
      </div>
    </header>
  );
}
