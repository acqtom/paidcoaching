import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function HeadlineGeneratorPage() {
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

      <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
          <Sparkles size={22} strokeWidth={2} />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Winning Headline Generator</h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          This tool is being built — check back soon.
        </p>
      </main>
    </div>
  );
}
