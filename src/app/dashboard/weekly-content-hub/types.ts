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
  return titles.map((title, i) => ({
    id: title === "-----Drive hub------" ? DRIVE_HUB_DOC_ID : makeId(),
    title,
    body: "",
    position: i,
    createdAt: now + i,
    ...(title === "-----Drive hub------" ? { driveHub: defaultDriveHubSections() } : {}),
  }));
}

// Seeded with the actual recurring weekly rhythm already in use, same as
// the Content tab's default documents and the Drive Hub folder names --
// a real starting point rather than blank cells.
export function defaultContentCalendar(): ContentCalendarState {
  const newContent: CalendarColumnDef = { id: makeId(), label: "New Content" };
  const creatorFilm: CalendarColumnDef = { id: makeId(), label: "Creator Film" };
  const postProduction: CalendarColumnDef = { id: makeId(), label: "Post Production / Editing" };
  const goesLive: CalendarColumnDef = { id: makeId(), label: "Goes Live" };
  const columns = [newContent, creatorFilm, postProduction, goesLive];

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

  cells.Monday = { ...cells.Monday, [postProduction.id]: "Edit YT #2", [goesLive.id]: "Reel #1" };
  cells.Tuesday = { ...cells.Tuesday, [postProduction.id]: "Edit YT #2", [goesLive.id]: "Youtube #1" };
  cells.Wednesday = { ...cells.Wednesday, [postProduction.id]: "Edit YT #2", [goesLive.id]: "Reel #2" };
  cells.Thursday = {
    ...cells.Thursday,
    [newContent.id]: "Sent",
    [creatorFilm.id]: "Bulk record x4 reels",
    [postProduction.id]: "Edit YT #2",
    [goesLive.id]: "Reel #3 + ads",
  };
  cells.Friday = {
    ...cells.Friday,
    [creatorFilm.id]: "Bulk record x5 ads",
    [postProduction.id]: "Edit YT #1",
    [goesLive.id]: "Youtube #2",
  };
  cells.Saturday = {
    ...cells.Saturday,
    [creatorFilm.id]: "Youtube #1\nYoutube #2",
    [postProduction.id]: "Edit YT #1",
    [goesLive.id]: "Reel #4",
  };
  cells.Sunday = { ...cells.Sunday, [postProduction.id]: "Edit YT #1" };

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
