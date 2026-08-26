"use client";

import { useActionState, useState } from "react";
import {
  signInAction,
  requestPasswordResetAction,
  type SignInState,
  type RequestPasswordResetState,
} from "@/lib/admin/auth-actions";
import { AdminButton, AdminInput, AdminLabel } from "@/components/admin/ui";

const initialSignInState: SignInState = { error: null };
const initialResetState: RequestPasswordResetState = { submitted: false, error: null };

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialResetState);

  if (state.submitted) {
    return (
      <div className="space-y-4">
        <p className="border border-secondary-400/50 bg-secondary-400/10 px-3 py-2 font-body text-sm text-foreground">
          If that email has an account, a reset link is on its way.
        </p>
        <button type="button" onClick={onBack} className="font-body text-sm text-secondary-400 hover:underline">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <AdminLabel htmlFor="reset-email">Email</AdminLabel>
        <AdminInput id="reset-email" name="email" type="email" autoComplete="username" required />
      </div>

      {state.error && (
        <p role="alert" className="border border-danger/50 bg-danger/10 px-3 py-2 font-body text-sm text-danger">
          {state.error}
        </p>
      )}

      <AdminButton type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </AdminButton>
      <button type="button" onClick={onBack} className="font-body text-sm text-foreground-muted hover:text-foreground">
        Back to sign in
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, initialSignInState);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-gutter">
      <div className="w-full max-w-sm border border-border bg-surface p-8">
        <p className="font-display text-lg font-semibold tracking-wide text-foreground">SPRINGBOARD</p>
        <p className="mt-1 mb-8 font-body text-sm text-foreground-muted">Editorial admin</p>

        {showForgotPassword ? (
          <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
        ) : (
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
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="font-body text-sm text-foreground-muted hover:text-foreground"
            >
              Forgot password?
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
