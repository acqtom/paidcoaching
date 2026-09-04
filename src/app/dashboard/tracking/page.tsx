import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { isAdminUsername } from "@/lib/is-admin-username";
import { BoardSwitcher } from "@/components/BoardSwitcher";

export default async function TrackingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const isAdmin = isAdminUsername(profile?.username ?? "");

  const iframeSrc = profile?.username
    ? `/tracking-app/index.html?user=${encodeURIComponent(profile.username)}`
    : "/tracking-app/index.html";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Logo />
          <Link
            href="/dashboard"
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      {isAdmin ? (
        <BoardSwitcher
          iframeTitle="Metrics Tracking"
          buildIframeSrc={(b) =>
            `/tracking-app/index.html?board=${encodeURIComponent(b.id)}&board_name=${encodeURIComponent(b.name)}`
          }
          emptyMessage="No boards yet — add one from the Sales Team Board or here to start tracking its metrics."
        />
      ) : (
        <iframe
          src={iframeSrc}
          title="Metrics Tracking"
          className="flex-1 w-full border-0"
        />
      )}
    </div>
  );
}
