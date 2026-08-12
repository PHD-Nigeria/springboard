import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Anon-key Supabase client for use in Client Components. Subject to RLS as
 * whatever role the current session holds (or fully anonymous).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
