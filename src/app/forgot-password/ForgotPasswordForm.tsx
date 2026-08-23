"use client";

import { useActionState } from "react";
import { forgotPassword, type ActionState } from "@/lib/auth-actions";
import { FormField, FormError, FormNotice, SubmitButton } from "@/components/AuthCard";

const initialState: ActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPassword, initialState);

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
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}
