"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SignInState {
  error: string | null;
}

/**
 * Signs in against Supabase Auth's existing email/password flow — no custom
 * session/JWT mechanism. A successful sign-in still only grants whatever
 * `profiles.role` the account already has (default 'viewer' on first
 * sign-up); RLS is what actually decides what that session can read/write.
 * There is deliberately no admin self-signup action here — see
 * docs/architecture.md's "First-admin provisioning" section for how a
 * first admin account gets provisioned.
 */
export async function signInAction(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter both email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export interface RequestPasswordResetState {
  submitted: boolean;
  error: string | null;
}

/**
 * Triggers Supabase's built-in recovery email. `redirectTo` must be an
 * absolute URL already present in the Supabase project's redirect-URL
 * allow-list (see docs/architecture.md's "Password recovery" section) —
 * otherwise
 * Supabase silently falls back to the project's bare Site URL instead of
 * /admin/reset-password, which is the exact bug this flow was built to fix.
 *
 * Always reports success regardless of whether the email exists —
 * `resetPasswordForEmail` itself doesn't reveal that either, so there is
 * nothing to leak by matching its behavior; a distinct error path here
 * would just re-introduce the account-enumeration Supabase already avoids.
 */
export async function requestPasswordResetAction(
  _prevState: RequestPasswordResetState,
  formData: FormData
): Promise<RequestPasswordResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { submitted: false, error: "Enter your email address." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return { submitted: false, error: "Password reset isn't configured yet — contact an administrator." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl.replace(/\/$/, "")}/admin/reset-password`,
  });

  if (error) {
    return { submitted: false, error: "Something went wrong. Try again shortly." };
  }

  return { submitted: true, error: null };
}

export interface UpdatePasswordState {
  success: boolean;
  error: string | null;
}

/**
 * Completes the recovery flow from /admin/reset-password. Requires an
 * active Supabase recovery session — established client-side (by
 * @supabase/ssr automatically detecting the recovery token in the URL,
 * which also writes the session cookie this cookie-based client reads —
 * see src/lib/supabase/client.ts) before this action is ever called, not
 * by anything this function does itself. Supabase's own
 * `minimum_password_length`/strength rules are the actual enforcement;
 * the reset-password page only does a light client-side match/length
 * check before submitting.
 */
export async function updatePasswordAction(password: string): Promise<UpdatePasswordState> {
  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}
