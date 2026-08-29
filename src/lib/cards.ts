import {
  BarChart3,
  Calendar,
  CalendarClock,
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
  comingSoon?: boolean;
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
    href: "https://daily.paidcoaching.com",
  },
  {
    slug: "metrics-tracking",
    title: "Metrics Tracking",
    description: "Track key performance metrics across the team.",
    icon: BarChart3,
    href: "https://tracking.helmbury.com",
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
    href: "https://sop.paidcoaching.com",
  },
  {
    slug: "accounting",
    title: "Accounting",
    description: "Books, invoices, and financial records.",
    icon: FileText,
    href: "https://accounting.paidcoaching.com",
  },
  {
    slug: "task-backlog",
    title: "Prioritization Task Backlog",
    description: "The full backlog, ready to be triaged.",
    icon: Layers,
    href: "https://backlog.paidcoaching.com",
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
  {
    slug: "book-a-call",
    title: "Book a Call",
    description: "Grab time on the calendar via Calendly.",
    icon: CalendarClock,
    href: "/dashboard/book-a-call",
    comingSoon: true,
  },
];
