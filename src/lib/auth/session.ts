import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

export interface AdminSession {
  userId: string;
  email: string | null;
  role: UserRole;
}

const ADMIN_ROLES: UserRole[] = ["contributor", "editor", "admin"];

/**
 * Reads the current request's authenticated user + their profiles.role,
 * using the cookie-aware (RLS-subject) server client — never the
 * service-role client. This is a UX convenience for redirecting/hiding
 * admin UI early; it is NOT the security boundary. Every admin mutation
 * still goes through RLS via the same cookie-based client, so even a bug
 * here can't grant a write RLS wouldn't otherwise allow.
 *
 * Returns null if there's no signed-in user, or their profile role is
 * 'viewer' (the default for a freshly-signed-up account — see
 * supabase/seed.sql's first-admin promotion note).
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !ADMIN_ROLES.includes(profile.role)) return null;

  return { userId: user.id, email: user.email ?? null, role: profile.role };
}
