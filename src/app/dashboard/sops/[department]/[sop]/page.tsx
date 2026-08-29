import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { DEPARTMENTS } from "@/lib/sops";
import { SopDetail } from "./SopDetail";

export function generateStaticParams() {
  return DEPARTMENTS.flatMap((department) =>
    department.sops.map((sop) => ({
      department: department.slug,
      sop: sop.slug,
    })),
  );
}

export default async function SopPage({
  params,
}: {
  params: Promise<{ department: string; sop: string }>;
}) {
  const { department: departmentSlug, sop: sopSlug } = await params;
  const department = DEPARTMENTS.find((d) => d.slug === departmentSlug);
  const sop = department?.sops.find((s) => s.slug === sopSlug);

  if (!department || !sop) {
    notFound();
  }

  return (
    <div className="min-h-full flex-1 bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Logo />
          <Link
            href={`/dashboard/sops/${department.slug}`}
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ← {department.title}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-xl font-semibold">{sop.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{sop.description}</p>

        <div className="mt-6">
          <SopDetail sop={sop} />
        </div>
      </main>
    </div>
  );
}
