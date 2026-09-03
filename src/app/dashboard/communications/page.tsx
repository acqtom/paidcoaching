import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { CommunicationsApp } from "./CommunicationsApp";

export default async function CommunicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const username = profile?.username ?? "";
  const isAdmin = username.length === 1;

  return (
    // Unlike every other page here, this one needs a bounded height (h-screen,
    // not min-h-full) so the message list scrolls internally and the composer
    // stays pinned near the bottom, the way a chat UI should -- a deliberate
    // exception to the "just let the whole page scroll" pattern used elsewhere.
    <div className="flex h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
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

      <div className="min-h-0 flex-1">
        <CommunicationsApp userId={user.id} username={username} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
