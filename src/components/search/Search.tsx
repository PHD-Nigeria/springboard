"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * The search field: a plain GET-style query (?q=) driven through the
 * router rather than a live/debounced-fetch widget, matching how every
 * other page in this app resolves state through the URL + a Server
 * Component read (see src/app/search/page.tsx). Client-only because
 * typing/submission needs local state and router.push — the actual query
 * still runs server-side via Content search on submit, not here.
 */
export function Search({ initialQuery }: { initialQuery: string }) {
  const [value, setValue] = useState(initialQuery);
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex border border-border bg-surface transition-colors duration-fast focus-within:border-secondary-400"
    >
      <label htmlFor="search-input" className="sr-only">
        Search Springboard
      </label>
      <input
        id="search-input"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search Springboard…"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent px-6 py-5 font-display text-xl text-foreground placeholder:text-foreground-muted focus-visible:outline-none md:text-2xl"
      />
      <button
        id="search-submit"
        type="submit"
        aria-label="Search"
        className="flex shrink-0 items-center justify-center border-l border-border px-6 text-foreground-muted transition-colors duration-fast hover:text-secondary-400 focus-visible:text-secondary-400 focus-visible:outline-2 focus-visible:outline-secondary-400 focus-visible:-outline-offset-2"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.2" y2="16.2" />
        </svg>
      </button>
    </form>
  );
}
