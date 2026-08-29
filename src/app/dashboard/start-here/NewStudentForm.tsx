"use client";

import { useState, type FormEvent } from "react";
import { FormField, SubmitButton, FormNotice } from "@/components/AuthCard";

export function NewStudentForm() {
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setTimeout(() => {
      setPending(false);
      setSubmitted(true);
    }, 400);
  }

  if (submitted) {
    return <FormNotice message="Thanks! We've got your details." />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Full name" name="fullName" required />
      <FormField label="Email" type="email" name="email" required />
      <FormField label="Phone number" type="tel" name="phone" />
      <FormField
        label="Which program are you joining?"
        name="program"
        placeholder="e.g. Coaching Accelerator"
        required
      />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Anything we should know before you start?
        </span>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
        />
      </label>
      <SubmitButton pending={pending}>Submit</SubmitButton>
    </form>
  );
}
