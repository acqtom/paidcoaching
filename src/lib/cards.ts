import {
  BarChart3,
  Calendar,
  FileText,
  FolderOpen,
  Funnel,
  Layers,
  ListChecks,
  MessagesSquare,
  Rocket,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type Card = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  accent?: "gold";
};

export const CARDS: Card[] = [
  {
    slug: "start-here",
    title: "Start Here",
    description: "New to the portal? Begin with this first.",
    icon: Rocket,
    href: "/dashboard/start-here",
    accent: "gold",
  },
  {
    slug: "daily-kill-list",
    title: "Daily Kill List",
    description: "Today's must-do tasks, ranked by priority.",
    icon: ListChecks,
    href: "/dashboard/daily-kill-list",
  },
  {
    slug: "metrics-tracking",
    title: "Metrics Tracking",
    description: "Track key performance metrics across the team.",
    icon: BarChart3,
    href: "/dashboard/tracking",
  },
  {
    slug: "funnel-revenue-projections",
    title: "Funnel Revenue Projections",
    description: "Projected revenue across each stage of the funnel.",
    icon: Funnel,
    href: "https://projections.paidcoaching.com",
  },
  {
    slug: "sops",
    title: "SOPs",
    description: "Standard operating procedures and playbooks.",
    icon: FolderOpen,
    href: "/dashboard/sops",
  },
  {
    slug: "accounting",
    title: "Accounting",
    description: "Books, invoices, and financial records.",
    icon: FileText,
    href: "/dashboard/accounting",
  },
  {
    slug: "task-backlog",
    title: "Prioritization Task Backlog",
    description: "The full backlog, ready to be triaged.",
    icon: Layers,
    href: "/dashboard/task-backlog",
  },
  {
    slug: "weekly-content-hub",
    title: "Weekly Content Hub",
    description: "This week's content plan and assets.",
    icon: Calendar,
    href: "https://content.paidcoaching.com",
  },
  {
    slug: "sales-team-board",
    title: "Sales Team Board",
    description: "Pipeline, deals, and sales team updates.",
    icon: TrendingUp,
    href: "https://board.helmbury.com",
  },
  {
    slug: "communications",
    title: "Communications",
    description: "Private chat and community, all in one place.",
    icon: MessagesSquare,
    href: "https://comms.paidcoaching.com",
  },
];
