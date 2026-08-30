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

export type ContentTemplateType =
  | "videoOverview"
  | "videoScript"
  | "titleThumb"
  | "instagramScript"
  | "instagramStories"
  | "adScript"
  | "adOverview";

export type ContentDoc = {
  id: string;
  title: string;
  body: string;
  position: number;
  createdAt: number;
  // Only set on the seeded Drive Hub document -- when present, the Content
  // tab renders this structured table instead of the plain body editor.
  driveHub?: DriveHubSection[];
  // Set on the other seeded structured documents (overviews, scripts,
  // title/thumb, ads) -- when present, the Content tab renders the
  // matching fixed-field card layout from ContentTemplates.tsx instead of
  // the plain body editor. Field labels/instructions live in code (not
  // user-editable structure, only the values are); templateData is a flat
  // map of field-key -> the user's text for that field.
  templateType?: ContentTemplateType;
  templateData?: Record<string, string>;
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

// Columns are user-defined (add/rename/remove), not a fixed set -- the
// four below are just the seeded starting point.
export type CalendarColumnDef = {
  id: string;
  label: string;
};

export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// One weekly rhythm, not a specific week's dated schedule -- cells[day][columnId]
// is free text, re-used every week rather than reset.
export type ContentCalendarState = {
  columns: CalendarColumnDef[];
  cells: Record<string, Record<string, string>>;
};

export type ContentHubState = {
  kanban: KanbanCard[];
  documents: ContentDoc[];
  teamMembers: TeamMember[];
  contentCalendar: ContentCalendarState;
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

// Which structured card layout each seeded document title gets instead of
// the plain body editor.
const TEMPLATE_BY_TITLE: Record<string, ContentTemplateType> = {
  "Youtube #1: Overview": "videoOverview",
  "Youtube #1: Script": "videoScript",
  "Youtube #1: Title / Thumb": "titleThumb",
  "Youtube #2: Overview": "videoOverview",
  "Youtube #2: Script": "videoScript",
  "Youtube #2: Title / Thumb": "titleThumb",
  "Instagram: Scripts": "instagramScript",
  "Instagram: Stories": "instagramStories",
  "Ads: Overview": "adOverview",
  "Ads: Scripts": "adScript",
};

// The default sidebar template a brand-new (or pre-existing) user sees the
// first time they open the Content tab -- mirrors the planning structure
// already in use, so there's something useful here on day one rather than
// a blank list.
export function defaultDocuments(): ContentDoc[] {
  const titles = [
    "Youtube #1: Overview",
    "Youtube #1: Script",
    "Youtube #1: Title / Thumb",
    "----------------------",
    "Youtube #2: Overview",
    "Youtube #2: Script",
    "Youtube #2: Title / Thumb",
    "----------------------",
    "Instagram: Scripts",
    "Instagram: Stories",
    "----------------------",
    "Ads: Overview",
    "Ads: Scripts",
    "-----Drive hub------",
  ];
  const now = Date.now();
  return titles.map((title, i) => {
    const templateType = TEMPLATE_BY_TITLE[title];
    return {
      id: title === "-----Drive hub------" ? DRIVE_HUB_DOC_ID : makeId(),
      title,
      body: "",
      position: i,
      createdAt: now + i,
      ...(title === "-----Drive hub------" ? { driveHub: defaultDriveHubSections() } : {}),
      ...(templateType ? { templateType, templateData: {} } : {}),
    };
  });
}

// Columns are seeded with the same stage names as the Kanban board
// (Idea/Scripting/Filming/Editing/Published) -- shared label text only,
// not a live link to Kanban, and independently editable from here on
// (add/rename/remove) same as any other column. Cells start genuinely
// empty (no example content) -- the user fills in their own real
// schedule.
export function defaultContentCalendar(): ContentCalendarState {
  const columns: CalendarColumnDef[] = [
    { id: makeId(), label: "Idea" },
    { id: makeId(), label: "Scripting" },
    { id: makeId(), label: "Filming" },
    { id: makeId(), label: "Editing" },
    { id: makeId(), label: "Published" },
  ];

  const emptyRow = (): Record<string, string> => {
    const row: Record<string, string> = {};
    columns.forEach((c) => {
      row[c.id] = "";
    });
    return row;
  };
  const cells: Record<string, Record<string, string>> = {};
  DAYS_OF_WEEK.forEach((day) => {
    cells[day] = emptyRow();
  });

  return { columns, cells };
}

export function defaultContentHubState(): ContentHubState {
  return {
    kanban: [],
    documents: defaultDocuments(),
    teamMembers: [],
    contentCalendar: defaultContentCalendar(),
    accessCode: "",
    updatedAt: 0,
  };
}

export { makeId };
