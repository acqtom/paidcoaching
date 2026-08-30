export type Stage = "idea" | "scripting" | "filming" | "editing" | "published";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "scripting", label: "Scripting" },
  { id: "filming", label: "Filming" },
  { id: "editing", label: "Editing" },
  { id: "published", label: "Published" },
];

export type Priority = "high" | "medium" | "low";

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

export type KanbanCard = {
  id: string;
  title: string;
  notes: string;
  stage: Stage;
  priority: Priority;
  dueDate: string; // "YYYY-MM-DD", or "" for no due date
  position: number;
  createdAt: number;
};

export type ContentDoc = {
  id: string;
  title: string;
  body: string;
  position: number;
  createdAt: number;
  // Only set on the seeded Drive Hub document -- when present, the Content
  // tab renders this structured table instead of the plain body editor.
  driveHub?: DriveHubSection[];
};

// One row per file/asset a Drive folder should exist for. linkLabel is
// just the folder's display name for now (no url yet -- real Drive links
// come in a later pass); label is the fixed row name from the existing
// planning template.
export type DriveHubRow = {
  id: string;
  label: string;
  linkLabel: string;
};

export type DriveHubSection = {
  id: string;
  title: string;
  rows: DriveHubRow[];
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

// Fixed, well-known id for the one seeded document that gets the special
// Drive Hub table instead of the plain text editor -- stable across
// reloads (unlike the random makeId() every other document gets) so the
// Content tab can reliably tell this one apart.
export const DRIVE_HUB_DOC_ID = "drive-hub";

function driveHubRow(label: string, linkLabel: string): DriveHubRow {
  return { id: makeId(), label, linkLabel };
}

export function defaultDriveHubSections(): DriveHubSection[] {
  return [
    {
      id: makeId(),
      title: "Youtube video #1",
      rows: [
        driveHubRow("Raw file:", "Raw YT Videos"),
        driveHubRow("B-roll", "B-roll"),
        driveHubRow("Proof docs", "Proof / Receipts"),
        driveHubRow("Edit file #1 (revision)", "Revision YT videos"),
        driveHubRow("Edit file #2 (final)", "Final YT videos"),
        driveHubRow("Thumbnail x2", "Thumbnails"),
      ],
    },
    {
      id: makeId(),
      title: "Youtube video #2",
      rows: [
        driveHubRow("Raw file:", "Raw YT Videos"),
        driveHubRow("B-roll", "B-roll"),
        driveHubRow("Proof docs", "Proof / Receipts"),
        driveHubRow("Edit file #1 (revision)", "Revision YT videos"),
        driveHubRow("Edit file #2 (final)", "Final YT videos"),
        driveHubRow("Thumbnail x2", "Thumbnails"),
      ],
    },
    {
      id: makeId(),
      title: "Instagram Reels",
      rows: [
        driveHubRow("Raw file:", "Raw File Upload"),
        driveHubRow("B-roll", "B-roll"),
        driveHubRow("Proof docs", "Proof / Receipts"),
        driveHubRow("Edit file #1 (revision)", "Revised File Upload"),
        driveHubRow("Edit file #2 (final)", "Final Version"),
      ],
    },
    {
      id: makeId(),
      title: "Meta Ads",
      rows: [
        driveHubRow("Raw File:", "Raw File Ads"),
        driveHubRow("B-roll", "B-roll"),
        driveHubRow("Proof docs", "Proof / Receipts"),
        driveHubRow("Final edited version", "Edited Ads"),
      ],
    },
  ];
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
    id: title === "-----Drive hub------" ? DRIVE_HUB_DOC_ID : makeId(),
    title,
    body: "",
    position: i,
    createdAt: now + i,
    ...(title === "-----Drive hub------" ? { driveHub: defaultDriveHubSections() } : {}),
  }));
}

export function defaultContentHubState(): ContentHubState {
  return { kanban: [], documents: defaultDocuments(), teamMembers: [], accessCode: "", updatedAt: 0 };
}

export { makeId };
