import {
  BarChart3,
  Calendar,
  FileText,
  FolderOpen,
  Funnel,
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
    description: "Daily calls and braindump, plus the shared department backlog and yearly goals.",
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
    slug: "weekly-content-hub",
    title: "Weekly Content Hub",
    description: "Your own Kanban board and content docs.",
    icon: Calendar,
    href: "/dashboard/weekly-content-hub",
  },
  {
    slug: "sales-team-board",
    title: "Sales Team Board",
    description: "Pipeline, deals, and sales team updates.",
    icon: TrendingUp,
    href: "/dashboard/sales-board",
  },
  {
    slug: "communications",
    title: "Communications",
    description: "Private chat and community, all in one place.",
    icon: MessagesSquare,
    href: "https://comms.paidcoaching.com",
  },
];
