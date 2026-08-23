"use client";

import { useActionState } from "react";
import { signup, type ActionState } from "@/lib/auth-actions";
import { FormField, FormError, FormNotice, SubmitButton } from "@/components/AuthCard";

const initialState: ActionState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.success) {
    return <FormNotice message={state.success} />;
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <FormField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
      />
      <FormField
        label="Password"
        type="password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <FormField
        label="Confirm password"
        type="password"
        name="confirmPassword"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}
