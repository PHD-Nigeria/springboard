"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The thin strip above the masthead: which edition is current, and today's date. Both come from the server (the active
 * edition in the CMS, and the date in Lagos time). Hidden inside /admin, which has its own chrome. With no active edition
 * it shows only the date.
 */
export function UtilityBar({ edition, dateLabel }: { edition: { code: string | null; title: string; slug: string; months: string | null } | null; dateLabel: string }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div className="border-b border-primary-800 bg-neutral-950 text-xs text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-gutter py-1.5">
        {edition ? (
          <p className="min-w-0 truncate">
            <Link href={`/issues/${edition.slug}`} className="font-semibold text-secondary-400 hover:underline">
              Latest edition
            </Link>
            <span className="text-white/80">
              {" · "}
              {edition.code ? `${edition.code}${edition.months ? ` (${edition.months})` : ""}` : edition.title}
            </span>
          </p>
        ) : (
          <span />
        )}
        <p className="shrink-0 text-white/80">{dateLabel}</p>
      </div>
    </div>
  );
}
