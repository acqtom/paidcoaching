import { Cog, Handshake, Megaphone, PackageCheck, type LucideIcon } from "lucide-react";

export type Lesson = {
  slug: string;
  title: string;
  type: "pdf" | "video";
};

export type SubCategory = {
  name: string;
  lessons: Lesson[];
};

export type Sop = {
  slug: string;
  title: string;
  description: string;
  gradient: string;
  subCategories: SubCategory[];
};

export type Department = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  sops: Sop[];
};

const starterSubCategories: SubCategory[] = [
  {
    name: "Getting Started",
    lessons: [{ slug: "overview", title: "Overview", type: "video" }],
  },
];

const GRADIENTS = [
  "from-blue-600 to-indigo-800",
  "from-orange-400 via-pink-400 to-purple-500",
  "from-purple-700 to-fuchsia-600",
  "from-cyan-700 via-teal-700 to-slate-900",
  "from-neutral-800 to-neutral-950",
  "from-emerald-600 to-teal-800",
];

function sop(slug: string, title: string, description: string, i: number): Sop {
  return {
    slug,
    title,
    description,
    gradient: GRADIENTS[i % GRADIENTS.length],
    subCategories: starterSubCategories,
  };
}

export const DEPARTMENTS: Department[] = [
  {
    slug: "operations",
    title: "Operations",
    description: "Funnels, CRM, tracking, and automations.",
    icon: Cog,
    sops: [
      sop("vsl-funnel", "VSL Funnel", "How the VSL funnel is built and maintained.", 0),
      sop("webinar-funnel", "Webinar Funnel", "How the webinar funnel is built and maintained.", 1),
      sop(
        "confirmation-page-best-practices",
        "Confirmation Page Best Practices",
        "What makes a confirmation page convert.",
        2,
      ),
      sop("crm-setup", "CRM Setup / Organisation", "How the CRM is set up and kept organised.", 3),
      sop("tracking", "Tracking", "How tracking is set up across the funnel.", 4),
      sop("automations", "Zapier / Automations", "The automations that connect everything.", 5),
    ],
  },
  {
    slug: "marketing",
    title: "Marketing",
    description: "Webinars, VSLs, YouTube, and ads.",
    icon: Megaphone,
    sops: [
      sop("webinar-best-practices", "Webinar Best Practices", "How to run a webinar that converts.", 0),
      sop("vsl-best-practices", "VSL Best Practices", "How to write and produce a VSL that converts.", 1),
      sop("youtube-mastery", "YouTube Mastery", "How we approach YouTube as a channel.", 2),
      sop("ads-mastery", "Ads Mastery", "How we plan, launch, and manage ads.", 3),
    ],
  },
  {
    slug: "sales",
    title: "Sales",
    description: "Team management, setters, closers, and sales managers.",
    icon: Handshake,
    sops: [
      sop("managing-a-team", "Managing a Team", "How to manage the sales team.", 0),
      sop("setters", "Setters", "The setter role and process.", 1),
      sop("closers", "Closers", "The closer role and process.", 2),
      sop("sales-managers", "Sales Managers", "The sales manager role and process.", 3),
    ],
  },
  {
    slug: "fulfilment",
    title: "Fulfilment",
    description: "Delivering on what was sold.",
    icon: PackageCheck,
    sops: [],
  },
];
