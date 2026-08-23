import {
  BarChart3,
  Calendar,
  FileText,
  FolderOpen,
  Layers,
  ListChecks,
  MessageCircle,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Card = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const CARDS: Card[] = [
  {
    slug: "daily-kill-list",
    title: "Daily Kill List",
    description: "Today's must-do tasks, ranked by priority.",
    icon: ListChecks,
  },
  {
    slug: "metrics-tracking",
    title: "Metrics Tracking",
    description: "Track key performance metrics across the team.",
    icon: BarChart3,
  },
  {
    slug: "sops",
    title: "SOPs",
    description: "Standard operating procedures and playbooks.",
    icon: FolderOpen,
  },
  {
    slug: "accounting",
    title: "Accounting",
    description: "Books, invoices, and financial records.",
    icon: FileText,
  },
  {
    slug: "task-backlog",
    title: "Prioritization Task Backlog",
    description: "The full backlog, ready to be triaged.",
    icon: Layers,
  },
  {
    slug: "weekly-content-hub",
    title: "Weekly Content Hub",
    description: "This week's content plan and assets.",
    icon: Calendar,
  },
  {
    slug: "sales-team-board",
    title: "Sales Team Board",
    description: "Pipeline, deals, and sales team updates.",
    icon: TrendingUp,
  },
  {
    slug: "private-chat",
    title: "Private Chat",
    description: "1:1 and group messaging with the team.",
    icon: MessageCircle,
  },
  {
    slug: "community",
    title: "Community",
    description: "Connect with other students across the hub.",
    icon: Users,
  },
];
