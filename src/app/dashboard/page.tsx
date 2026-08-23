import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth-actions";
import { CARDS } from "@/lib/cards";
import { Logo } from "@/components/Logo";

export default async function DashboardPage() {
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

  return (
    <div className="min-h-full flex-1 bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">
              {profile?.username ? `@${profile.username}` : user?.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick a workspace to jump in.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <Link
              key={card.slug}
              href={`/dashboard/${card.slug}`}
              className="group rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-2xl">{card.emoji}</div>
              <h2 className="mt-3 font-semibold text-neutral-900 dark:text-neutral-100">
                {card.title}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
