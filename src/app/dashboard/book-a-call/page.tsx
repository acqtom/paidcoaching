import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function BookACallPage() {
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

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-semibold">Book a Call</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A Calendly embed will go here.
        </p>

        <div className="mt-6 flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-950 text-neutral-500">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 dark:bg-black/30">
            <CalendarClock size={22} />
          </span>
          <span className="text-sm font-medium">Calendly embed coming soon</span>
        </div>
      </main>
    </div>
  );
}
