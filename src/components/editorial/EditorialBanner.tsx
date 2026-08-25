import Link from "next/link";
import type { ReactNode } from "react";

interface EditorialBannerProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  cta?: { label: string; href: string };
}

/** Full-width editorial statement section — a break in rhythm between grids, not another card. */
export function EditorialBanner({ eyebrow, title, description, cta }: EditorialBannerProps) {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-4xl px-gutter py-section-md text-center">
        {eyebrow && (
          <p className="mb-4 font-body text-xs font-medium tracking-wide text-primary-400 uppercase">
            {eyebrow}
          </p>
        )}
        <p className="font-display text-4xl leading-snug font-medium text-foreground md:text-6xl">
          {title}
        </p>
        {description && (
          <p className="mx-auto mt-6 max-w-xl font-body text-base leading-relaxed text-foreground-muted">
            {description}
          </p>
        )}
        {cta && (
          <Link
            href={cta.href}
            className="mt-8 inline-block border-b border-secondary-400 pb-1 font-body text-sm tracking-wide text-foreground transition-colors duration-fast hover:border-secondary-300 hover:text-secondary-300"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </section>
  );
}
