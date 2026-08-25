"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/lib/admin/auth-actions";
import { AdminButton, AdminInput, AdminLabel } from "@/components/admin/ui";

const initialState: SignInState = { error: null };

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-gutter">
      <div className="w-full max-w-sm border border-border bg-surface p-8">
        <p className="font-display text-lg font-semibold tracking-wide text-foreground">SPRINGBOARD</p>
        <p className="mt-1 mb-8 font-body text-sm text-foreground-muted">Editorial admin</p>

        <form action={formAction} className="space-y-5">
          <div>
            <AdminLabel htmlFor="email">Email</AdminLabel>
            <AdminInput id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div>
            <AdminLabel htmlFor="password">Password</AdminLabel>
            <AdminInput id="password" name="password" type="password" autoComplete="current-password" required />
          </div>

          {state.error && (
            <p role="alert" className="border border-danger/50 bg-danger/10 px-3 py-2 font-body text-sm text-danger">
              {state.error}
            </p>
          )}

          <AdminButton type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </AdminButton>
        </form>
      </div>
    </main>
  );
}
