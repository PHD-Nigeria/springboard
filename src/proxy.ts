import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 renamed Middleware to Proxy (same mechanism, new file/export
 * name — see node_modules/next/dist/docs/.../file-conventions/proxy.md).
 * This is the standard @supabase/ssr session-refresh pattern, run here
 * because it's the only place that can reliably write the refreshed auth
 * cookie on every request — src/lib/supabase/server.ts's cookie `setAll`
 * silently no-ops in Server Components, which can only read cookies.
 *
 * Deliberately does nothing beyond refreshing the session: no route
 * protection, no redirects, no role checks. Real auth gating is Phase 2+.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (not getSession()) revalidates the token against the Auth
  // server rather than trusting a possibly-stale/tampered cookie — this is
  // what actually performs the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and image optimization — running the proxy (and
    // its Supabase round-trip) on every CSS/JS/image request is wasted work
    // and, per the Next.js docs, can unintentionally block asset loading.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|css|js|ico)$).*)",
  ],
};
