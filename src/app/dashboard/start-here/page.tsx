import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StartHereTabs } from "./StartHereTabs";

export default function StartHerePage() {
  return (
    <div className="min-h-full flex-1 bg-neutral-50 dark:bg-neutral-950">
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

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-xl font-semibold">Start Here</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick the view for your role.
        </p>

        <div className="mt-6">
          <StartHereTabs />
        </div>
      </main>
    </div>
  );
}
