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
 * docs/architecture.md's Auth Setup section for how a first admin account
 * gets provisioned.
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
