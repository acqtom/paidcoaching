"use client";

import { useActionState } from "react";
import { resetPassword, type ActionState } from "@/lib/auth-actions";
import { FormField, FormError, SubmitButton } from "@/components/AuthCard";

const initialState: ActionState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <FormField
        label="New password"
        type="password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <FormField
        label="Confirm new password"
        type="password"
        name="confirmPassword"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <SubmitButton pending={pending}>Update password</SubmitButton>
    </form>
  );
}
