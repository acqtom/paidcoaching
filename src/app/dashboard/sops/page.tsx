import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DEPARTMENTS } from "@/lib/sops";

export default function SopsPage() {
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
        <h1 className="text-xl font-semibold">SOPs</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick a department to see its playbooks.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((department) => {
            const Icon = department.icon;
            return (
              <Link
                key={department.slug}
                href={`/dashboard/sops/${department.slug}`}
                className="group relative flex min-h-[160px] flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-6 shadow-lg shadow-neutral-300/40 dark:shadow-black/50 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:from-white hover:to-neutral-100 dark:hover:from-neutral-700 dark:hover:to-neutral-800 hover:shadow-xl hover:shadow-neutral-300/60 dark:hover:shadow-black/70"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {department.title}
                  </h2>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                </div>
                <p className="text-sm text-neutral-500">{department.description}</p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
