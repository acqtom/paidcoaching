"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string };

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export async function login(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(redirectTo || "/dashboard");
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export async function signup(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!USERNAME_PATTERN.test(username)) {
    return {
      error:
        "Username must be at least 3 characters, letters/numbers/underscores only.",
    };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existing) {
    return { error: "That username is already taken." };
  }

  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      // Lands on /login (not /dashboard) after confirming, per explicit
      // direction -- confirming does log them in, so /dashboard would
      // technically also work, but /login is the one clearly "correct"
      // landing spot they asked for either way.
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/login`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    success:
      "Account created. Check your email to confirm your address before logging in.",
  };
}

export async function forgotPassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: "If that email has an account, a reset link is on its way.",
  };
}

export async function resetPassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  await supabase.auth.signOut();
  redirect("/login?reset=success");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
