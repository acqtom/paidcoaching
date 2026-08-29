import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Logo } from "@/components/Logo";
import { DEPARTMENTS } from "@/lib/sops";

export function generateStaticParams() {
  return DEPARTMENTS.map((department) => ({ department: department.slug }));
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: departmentSlug } = await params;
  const department = DEPARTMENTS.find((d) => d.slug === departmentSlug);

  if (!department) {
    notFound();
  }

  return (
    <div className="min-h-full flex-1 bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Logo />
          <Link
            href="/dashboard/sops"
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ← SOPs
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-xl font-semibold">{department.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{department.description}</p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {department.sops.map((sop) => {
            const lessonCount = sop.subCategories.reduce(
              (total, category) => total + category.lessons.length,
              0,
            );
            return (
              <Link
                key={sop.slug}
                href={`/dashboard/sops/${department.slug}/${sop.slug}`}
                className="group overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg shadow-neutral-300/40 dark:shadow-black/50 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-xl"
              >
                <div className={`aspect-video w-full bg-gradient-to-br ${sop.gradient}`} />
                <div className="p-4">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {sop.title}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">{sop.description}</p>
                  <p className="mt-3 text-xs text-neutral-400">
                    {sop.subCategories.length}{" "}
                    {sop.subCategories.length === 1 ? "category" : "categories"} ·{" "}
                    {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
                  </p>
                </div>
              </Link>
            );
          })}

          <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400">
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-700">
                <Plus size={18} />
              </span>
              <span className="text-sm font-medium">Add SOP</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
