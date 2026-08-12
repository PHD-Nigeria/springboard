"use client";

import { useState } from "react";

/**
 * Placeholder — search input. Queries Postgres full-text search
 * (public.content.search_vector) via a server action/route once wired up.
 */
export function Search() {
  const [query, setQuery] = useState("");

  return (
    <form role="search">
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Springboard"
      />
    </form>
  );
}
