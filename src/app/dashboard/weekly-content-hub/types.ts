export type Stage = "idea" | "scripting" | "filming" | "editing" | "published";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "scripting", label: "Scripting" },
  { id: "filming", label: "Filming" },
  { id: "editing", label: "Editing" },
  { id: "published", label: "Published" },
];

export type KanbanCard = {
  id: string;
  title: string;
  notes: string;
  stage: Stage;
  position: number;
  createdAt: number;
};

export type ContentDoc = {
  id: string;
  title: string;
  body: string;
  position: number;
  createdAt: number;
};

// One general owner per Kanban stage (not a per-card assignee) -- shown as
// a label under that column's header on the board.
export type TeamMember = {
  id: string;
  name: string;
  stage: Stage;
  createdAt: number;
};

export type ContentHubState = {
  kanban: KanbanCard[];
  documents: ContentDoc[];
  teamMembers: TeamMember[];
  accessCode: string;
  updatedAt: number;
};

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// The default sidebar template a brand-new (or pre-existing) user sees the
// first time they open the Content tab -- mirrors the planning structure
// already in use, so there's something useful here on day one rather than
// a blank list.
export function defaultDocuments(): ContentDoc[] {
  const titles = [
    "-----Directory-----",
    "Youtube #1: Overview",
    "Youtube #1: Script",
    "Youtube #1: Title / Thumb",
    "Youtube #1: Asset Hub",
    "----------------------",
    "Youtube #2: Overview",
    "Youtube #2: Script",
    "Youtube #2: Title / Thumb",
    "Youtube #2: Asset Hub",
    "----------------------",
    "Instagram: Scripts",
    "Instagram: Stories",
    "Instagram: Asset Hub",
    "----------------------",
    "Ads: Overview",
    "Ads: Scripts",
    "Ads: Asset Hub",
    "-----Drive hub------",
  ];
  const now = Date.now();
  return titles.map((title, i) => ({
    id: makeId(),
    title,
    body: "",
    position: i,
    createdAt: now + i,
  }));
}

export function defaultContentHubState(): ContentHubState {
  return { kanban: [], documents: defaultDocuments(), teamMembers: [], accessCode: "", updatedAt: 0 };
}

export { makeId };
