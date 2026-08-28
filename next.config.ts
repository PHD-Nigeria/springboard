import type { NextConfig } from "next";

// Allow next/image to optimize images served from Supabase Storage's public
// URLs (`/storage/v1/object/public/...`). Derived from the same env var the
// Supabase clients already use, rather than hardcoding a host — works
// unmodified against the local stack (http://127.0.0.1:20321) and a hosted
// project (https://<ref>.supabase.co) alike.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;

const nextConfig: NextConfig = {
  // The in-app User Guide (/admin/guide) reads docs/user-guide/*.md and
  // docs/user-guide/images/*.png from disk at request time — its parent
  // layout checks the signed-in session via cookies, which forces the
  // whole route to render dynamically (not statically), so these files
  // must be traced into the deployed serverless function or a production
  // request would 404/500 trying to read a file that was never bundled.
  // See src/lib/guide/content.ts and .../guide/images/[...path]/route.ts.
  outputFileTracingIncludes: {
    "/admin/guide/**": ["docs/user-guide/**/*"],
  },

  images: {
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    // Next.js 16 added an SSRF guard that blocks the image optimizer from
    // fetching any host that resolves to a private IP — 127.0.0.1 (the
    // local Supabase stack) included, even though it's explicitly allowed
    // above via remotePatterns. Confirmed via node_modules/next/dist/docs's
    // upgrade guide ("Local IP Restriction (Breaking change)") after
    // real-browser testing surfaced a 400 on every /_next/image request in
    // dev — this flag is documented as the correct opt-in for exactly this
    // case. It's inert against a hosted Supabase project (a real domain
    // resolves to a public IP), so it doesn't weaken anything in production.
    dangerouslyAllowLocalIP: true,
  },

  // Standard hardening headers — none of these are the actual security
  // boundary (RLS/session auth is, same as everywhere else in this app);
  // they're defense-in-depth against browser-level attack classes RLS
  // doesn't address (clickjacking, MIME sniffing, referrer leakage). A
  // strict Content-Security-Policy is deliberately NOT included here — it
  // needs careful allowlisting against this app's actual script/style/image
  // sources and real testing before enabling, not a guess; see
  // docs/architecture.md's production-readiness section.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
