export type TypeformQuestion =
  | { id: string; type: "short_text"; question: string; placeholder?: string }
  | { id: string; type: "single_select"; question: string; options: string[] }
  // Checkboxes, not auto-advancing radio cards -- needs an explicit
  // Continue/Submit button since more than one option can be picked.
  // `allowOther` adds a trailing "Other" checkbox that reveals a text
  // input; the typed text is stored in place of the literal word
  // "Other" in the saved answer array, so reviewing it later shows what
  // they actually meant, not a placeholder label.
  | { id: string; type: "multi_select"; question: string; options: string[]; allowOther?: boolean };

// Underneath the CMO tab's Calendly embed on Start Here. Answers are
// stored keyed by these ids in intake_form_submissions.answers (see
// 0020_student_data.sql) -- admins review them from Student Data.
export const CMO_QUESTIONS: TypeformQuestion[] = [
  {
    id: "has_offer",
    type: "single_select",
    question: "Do you have an offer yet?",
    options: ["Yes and scaling", "No, starting from scratch"],
  },
  {
    id: "niche",
    type: "short_text",
    question: "What niche are you in?",
  },
  {
    id: "ad_spend",
    type: "single_select",
    question: "How much can you put towards ad spend in the next 30 days?",
    options: ["$1-2k", "$2-6k", "$6-12k+"],
  },
  {
    id: "ads_understanding",
    type: "single_select",
    question: "Do you understand how ads work and how to read their performance?",
    options: ["Yes, confidently", "Yes, somewhat", "No, have no idea."],
  },
  {
    id: "traffic_source",
    type: "single_select",
    question: "Are you posting on YouTube/IG or fully cold traffic?",
    options: ["Organic only right now", "Ads only right now", "Both", "Neither, starting from scratch"],
  },
  {
    id: "monthly_revenue",
    type: "single_select",
    question: "What is your current monthly revenue?",
    options: ["Under $10k", "$10k-$25k", "$25k-$50k", "$50k-$100k", "$100k+"],
  },
  {
    id: "tracking_data",
    type: "single_select",
    question: "Are you currently tracking your data?",
    options: ["Somewhat", "No"],
  },
];

// Underneath the CEO tab's Calendly embed. Started empty (hiding
// TypeformFlow entirely via the `questions.length > 0` guard in
// StartHereTabs.tsx) until this first batch shipped -- more to come
// later, per explicit direction.
export const CEO_QUESTIONS: TypeformQuestion[] = [
  {
    id: "backend_systems",
    type: "multi_select",
    question: "What backend systems are you using right now?",
    options: ["CRM", "Tracking systems", "Zapier", "Framer / landing page", "Discord / Slack"],
    allowOther: true,
  },
  {
    id: "sales_reps",
    type: "multi_select",
    question: "What sales reps do you have in place?",
    options: ["Closers", "Setters", "None (need some)"],
  },
];
