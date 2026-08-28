"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GuideSearchDocument } from "@/lib/guide/search";

const SNIPPET_RADIUS = 70;
const MAX_RESULTS = 8;

interface Result {
  href: string;
  title: string;
  snippet: string;
}

/** A short window of plain text around the first match, so a result reads as a real excerpt rather than just a title. */
function buildSnippet(text: string, query: string): string {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return text.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + query.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

/**
 * Client-side-only search over the guide's own text — no database, no
 * external service. `documents` is the entire (small) corpus, built once
 * server-side in the guide layout from the same Markdown the pages render
 * (see src/lib/guide/search.ts) and passed down as plain data.
 */
export function GuideSearch({ documents }: { documents: GuideSearchDocument[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo<Result[]>(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const needle = trimmed.toLowerCase();

    return documents
      .filter((doc) => doc.title.toLowerCase().includes(needle) || doc.text.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS)
      .map((doc) => ({
        href: doc.href,
        title: doc.title,
        snippet: doc.title.toLowerCase().includes(needle) ? doc.text.slice(0, SNIPPET_RADIUS * 2) : buildSnippet(doc.text, needle),
      }));
  }, [documents, query]);

  return (
    <div className="relative">
      <label htmlFor="guide-search" className="sr-only">
        Search the guide
      </label>
      <input
        id="guide-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search the guide…"
        className="w-full border border-border bg-surface px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus-visible:border-secondary-400"
      />

      {query.trim().length >= 2 && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-96 overflow-y-auto border border-border bg-surface shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 font-body text-sm text-foreground-muted">No matches for &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            results.map((result) => (
              <Link
                key={result.href}
                href={result.href}
                onClick={() => setQuery("")}
                className="block border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-surface-raised"
              >
                <p className="font-body text-sm font-medium text-foreground">{result.title}</p>
                <p className="mt-0.5 line-clamp-2 font-body text-xs text-foreground-muted">{result.snippet}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
