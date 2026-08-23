"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type ActionState } from "@/lib/auth-actions";
import { FormField, FormError, SubmitButton } from "@/components/AuthCard";

const initialState: ActionState = {};

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
      <FormError message={state.error} />
      <FormField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
      />
      <div>
        <FormField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
        <Link
          href="/forgot-password"
          className="mt-1 inline-block text-sm text-neutral-500 underline"
        >
          Forgot password?
        </Link>
      </div>
      <SubmitButton pending={pending}>Log in</SubmitButton>
    </form>
  );
}
