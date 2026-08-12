import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role Supabase client. Bypasses RLS entirely — never import this
 * module from a Client Component or anything that ends up in the browser
 * bundle. Reserved for privileged server-only operations (the future CMS's
 * publish/promote-media actions, admin scripts, etc.).
 *
 * The `server-only` import above is the enforcement: it makes importing
 * this module from client-bundled code a *build* error (not just a runtime
 * one) — see https://www.npmjs.com/package/server-only. The runtime guard
 * below is a second, redundant line of defense in case that ever changes.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() must never be called in the browser — it holds the Supabase service-role key."
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
