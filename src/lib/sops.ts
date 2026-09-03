import { Cog, Handshake, Megaphone, PackageCheck, type LucideIcon } from "lucide-react";

// The 4 departments are a fixed set with their own icons -- unlike the
// SOPs/sub-categories/lessons inside them (see 0016_sops.sql), these
// stay hardcoded rather than becoming admin-editable.
export type DepartmentSlug = "operations" | "marketing" | "sales" | "fulfilment";

export type Department = {
  slug: DepartmentSlug;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const DEPARTMENTS: Department[] = [
  {
    slug: "operations",
    title: "Operations",
    description: "Funnels, CRM, tracking, and automations.",
    icon: Cog,
  },
  {
    slug: "marketing",
    title: "Marketing",
    description: "Webinars, VSLs, YouTube, and ads.",
    icon: Megaphone,
  },
  {
    slug: "sales",
    title: "Sales",
    description: "Team management, setters, closers, and sales managers.",
    icon: Handshake,
  },
  {
    slug: "fulfilment",
    title: "Fulfilment",
    description: "Delivering on what was sold.",
    icon: PackageCheck,
  },
];

// Cycled through when a new SOP is created -- purely cosmetic (keeps a
// department's grid from looking monotone), not user-editable.
export const SOP_GRADIENTS = [
  "from-blue-600 to-indigo-800",
  "from-orange-400 via-pink-400 to-purple-500",
  "from-purple-700 to-fuchsia-600",
  "from-cyan-700 via-teal-700 to-slate-900",
  "from-neutral-800 to-neutral-950",
  "from-emerald-600 to-teal-800",
];
