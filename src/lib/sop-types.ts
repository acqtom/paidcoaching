export type SopLesson = {
  id: string;
  title: string;
  video_url: string | null;
  notes: string | null;
  position: number;
};

export type SopSubcategory = {
  id: string;
  name: string;
  position: number;
  lessons: SopLesson[];
};

export type SopSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  gradient: string;
  lessonCount: number;
  subcategoryCount: number;
};

export type SopDetailData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  subcategories: SopSubcategory[];
};

// Turns a Loom or YouTube share/watch URL into its embeddable form.
// Anything else (or an unparseable URL) falls back to a plain "watch"
// link rather than an iframe, since embedding arbitrary URLs isn't safe
// and most other video hosts don't support unauthenticated iframe embeds
// anyway.
export function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("loom.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.loom.com/embed/${id}` : null;
    }
    if (u.hostname.endsWith("youtube.com") && u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}
