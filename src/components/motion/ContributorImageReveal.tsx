"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { duration, easing } from "@/design-system/tokens/motion";
import { MediaFallback, initialsFromName } from "@/components/editorial/MediaFallback";

interface ContributorImageRevealProps {
  /** Null/undefined when the contributor has no portrait — renders a branded initials fallback instead. */
  src?: string | null;
  alt: string;
  /** Tailwind aspect-ratio utility, e.g. "aspect-[4/5]". Defaults to a portrait crop. */
  aspectClassName?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * The slow (4-5s), cinematic contributor portrait reveal. The outer element
 * is the only thing that determines layout size (fixed aspect-ratio,
 * overflow hidden) — it never changes, so there is zero layout shift. Only
 * the inner layer's `scale`/`opacity` (transform/opacity, both compositor-
 * only properties) animate.
 *
 * `prefers-reduced-motion` renders the final state immediately instead of
 * over 4-5 seconds — per the brief, an accessible static alternative, not
 * just a faster version of the same motion.
 */
export function ContributorImageReveal({
  src,
  alt,
  aspectClassName = "aspect-[4/5]",
  sizes = "(min-width: 1024px) 380px, 100vw",
  priority = false,
}: ContributorImageRevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`relative overflow-hidden bg-surface ${aspectClassName}`}>
      <motion.div
        className="absolute inset-0"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: duration.contributorReveal, ease: easing.editorialIn }
        }
      >
        {src ? (
          <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
        ) : (
          <MediaFallback seed={alt} initials={initialsFromName(alt)} />
        )}
      </motion.div>
    </div>
  );
}
