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
        label="Username"
        type="text"
        name="username"
        autoComplete="username"
        minLength={3}
        maxLength={20}
        pattern="[a-zA-Z0-9_]{3,20}"
        title="At least 3 characters: letters, numbers, and underscores only."
        placeholder="How other students will see you"
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
