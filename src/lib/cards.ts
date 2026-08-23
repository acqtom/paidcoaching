export type Card = {
  slug: string;
  title: string;
  description: string;
  emoji: string;
};

export const CARDS: Card[] = [
  {
    slug: "metrics-tracking",
    title: "Metrics Tracking",
    description: "Track key performance metrics across the team.",
    emoji: "📊",
  },
  {
    slug: "accounting",
    title: "Accounting",
    description: "Books, invoices, and financial records.",
    emoji: "💰",
  },
  {
    slug: "sops",
    title: "SOPs",
    description: "Standard operating procedures and playbooks.",
    emoji: "📘",
  },
  {
    slug: "daily-kill-list",
    title: "Daily Kill List",
    description: "Today's must-do tasks, ranked by priority.",
    emoji: "✅",
  },
  {
    slug: "task-backlog",
    title: "Prioritization Task Backlog",
    description: "The full backlog, ready to be triaged.",
    emoji: "🗂️",
  },
  {
    slug: "sales-team-board",
    title: "Sales Team Board",
    description: "Pipeline, deals, and sales team updates.",
    emoji: "📈",
  },
  {
    slug: "weekly-content-hub",
    title: "Weekly Content Hub",
    description: "This week's content plan and assets.",
    emoji: "🗓️",
  },
];
