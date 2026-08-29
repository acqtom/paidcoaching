"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/auth-actions";

const BUG_REPORT_RECIPIENT = "tom@educatr.co";

export async function submitBugReport(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const feature = String(formData.get("feature") ?? "").trim();
  const whatsWrong = String(formData.get("whatsWrong") ?? "").trim();
  const expected = String(formData.get("expected") ?? "").trim();

  if (!feature || !whatsWrong || !expected) {
    return { error: "Please fill in all fields." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Bug reporting isn't configured yet. Try again later." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    to: BUG_REPORT_RECIPIENT,
    replyTo: user?.email,
    subject: `Bug report: ${feature}`,
    text: [
      `Feature: ${feature}`,
      `Reported by: ${user?.email ?? "unknown"}`,
      "",
      "What's wrong:",
      whatsWrong,
      "",
      "What it should do instead:",
      expected,
    ].join("\n"),
  });

  if (error) {
    return { error: "Couldn't send the report. Try again later." };
  }

  return { success: "Thanks! Your bug report has been sent." };
}
