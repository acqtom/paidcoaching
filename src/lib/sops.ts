export type Lesson = {
  slug: string;
  title: string;
  type: "pdf" | "video";
};

export type Category = {
  name: string;
  lessons: Lesson[];
};

export type Sop = {
  slug: string;
  title: string;
  description: string;
  meta: string;
  gradient: string;
  categories: Category[];
};

export const SOPS: Sop[] = [
  {
    slug: "client-onboarding",
    title: "Client Onboarding",
    description: "How to onboard a new client from signed to set up.",
    meta: "3 chapters · 9 lessons",
    gradient: "from-blue-600 to-indigo-800",
    categories: [
      {
        name: "Setup",
        lessons: [
          { slug: "overview", title: "Overview", type: "pdf" },
          { slug: "kickoff-call", title: "Running the kickoff call", type: "video" },
          { slug: "client-info", title: "Client info + intake form", type: "video" },
        ],
      },
      {
        name: "Systems",
        lessons: [
          { slug: "cred-handoff", title: "Credential handoff", type: "video" },
          { slug: "project-setup", title: "Project board setup", type: "video" },
        ],
      },
      {
        name: "Resources",
        lessons: [{ slug: "templates", title: "Onboarding templates", type: "pdf" }],
      },
    ],
  },
  {
    slug: "sales-process",
    title: "Sales Process",
    description: "How to run discovery calls and close new students.",
    meta: "4 chapters · 12 lessons",
    gradient: "from-orange-400 via-pink-400 to-purple-500",
    categories: [
      {
        name: "Discovery",
        lessons: [
          { slug: "script", title: "Discovery call script", type: "pdf" },
          { slug: "objections", title: "Handling objections", type: "video" },
        ],
      },
      {
        name: "Closing",
        lessons: [
          { slug: "close-call", title: "Running the close call", type: "video" },
          { slug: "follow-up", title: "Follow-up sequence", type: "pdf" },
        ],
      },
    ],
  },
  {
    slug: "content-creation",
    title: "Content Creation",
    description: "How content gets planned, filmed, and published.",
    meta: "3 chapters · 10 lessons",
    gradient: "from-purple-700 to-fuchsia-600",
    categories: [
      {
        name: "Planning",
        lessons: [{ slug: "calendar", title: "Content calendar", type: "pdf" }],
      },
      {
        name: "Production",
        lessons: [
          { slug: "filming", title: "Filming checklist", type: "video" },
          { slug: "editing", title: "Editing handoff", type: "video" },
        ],
      },
    ],
  },
  {
    slug: "ads-management",
    title: "Ads Management",
    description: "Setting up, launching, and reporting on paid ads.",
    meta: "3 chapters · 8 lessons",
    gradient: "from-cyan-700 via-teal-700 to-slate-900",
    categories: [
      {
        name: "Launch",
        lessons: [
          { slug: "campaign-setup", title: "Campaign setup", type: "video" },
          { slug: "creative-specs", title: "Creative specs", type: "pdf" },
        ],
      },
      {
        name: "Reporting",
        lessons: [{ slug: "weekly-report", title: "Weekly report template", type: "pdf" }],
      },
    ],
  },
  {
    slug: "backend-systems",
    title: "Backend Systems",
    description: "All backend ops and systems that need to be set up.",
    meta: "3 chapters · 7 lessons",
    gradient: "from-neutral-800 to-neutral-950",
    categories: [
      {
        name: "Core systems",
        lessons: [
          { slug: "crm-setup", title: "CRM setup", type: "video" },
          { slug: "automations", title: "Automations overview", type: "video" },
        ],
      },
      {
        name: "Access",
        lessons: [{ slug: "permissions", title: "Team permissions", type: "pdf" }],
      },
    ],
  },
];
