"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updatePasswordAction } from "@/lib/admin/auth-actions";
import { AdminButton, AdminInput, AdminLabel } from "@/components/admin/ui";

type Status = "verifying" | "ready" | "invalid" | "success";

/**
 * Landing page for Supabase's password-recovery email link. The recovery
 * token (hash fragment or PKCE `code`, depending on how Supabase issued the
 * link) is parsed automatically by the browser Supabase client on mount —
 * see src/lib/supabase/client.ts — which then fires a PASSWORD_RECOVERY
 * auth event once that session is established. This page only needs to
 * wait for that event before showing the form; it never reads the URL
 * itself.
 *
 * Must be reachable at exactly this path with this recovery flow working —
 * it also needs to be in the Supabase project's redirect-URL allow-list, or
 * Supabase falls back to the bare Site URL instead of landing here at all
 * (see docs/architecture.md's "Password recovery" section).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setStatus("ready");
      }
    });

    // Covers the rare case where the recovery event already fired before
    // this listener attached — the session it left behind is still there.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!settled && session) {
        settled = true;
        setStatus("ready");
      }
    });

    const timeout = setTimeout(() => {
      if (!settled) setStatus("invalid");
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    const result = await updatePasswordAction(password);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setStatus("success");
    setTimeout(() => router.push("/admin/login"), 2000);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-gutter">
      <div className="w-full max-w-sm border border-border bg-surface p-8">
        <p className="font-display text-lg font-semibold tracking-wide text-foreground">SPRINGBOARD</p>
        <p className="mt-1 mb-8 font-body text-sm text-foreground-muted">Set a new password</p>

        {status === "verifying" && (
          <p className="font-body text-sm text-foreground-muted">Verifying your reset link…</p>
        )}

        {status === "invalid" && (
          <div className="space-y-4">
            <p className="border border-danger/50 bg-danger/10 px-3 py-2 font-body text-sm text-danger">
              This reset link is invalid or has expired.
            </p>
            <a href="/admin/login" className="font-body text-sm text-secondary-400 hover:underline">
              Back to sign in
            </a>
          </div>
        )}

        {status === "success" && (
          <p className="border border-secondary-400/50 bg-secondary-400/10 px-3 py-2 font-body text-sm text-foreground">
            Password updated. Redirecting to sign in…
          </p>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <AdminLabel htmlFor="password">New password</AdminLabel>
              <AdminInput
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <AdminLabel htmlFor="confirmPassword">Confirm password</AdminLabel>
              <AdminInput
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="border border-danger/50 bg-danger/10 px-3 py-2 font-body text-sm text-danger">
                {error}
              </p>
            )}

            <AdminButton type="submit" disabled={pending} className="w-full">
              {pending ? "Updating…" : "Update password"}
            </AdminButton>
          </form>
        )}
      </div>
    </main>
  );
}
