import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { DEPARTMENTS } from "@/lib/sops";
import { isAdminUsername } from "@/lib/is-admin-username";
import { createClient } from "@/lib/supabase/server";
import { DepartmentSopsGrid } from "./DepartmentSopsGrid";
import type { SopSummary } from "@/lib/sop-types";

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
  const isAdmin = isAdminUsername(profile?.username ?? "");

  const { data: sopsData } = await supabase
    .from("sops")
    .select("id, slug, title, description, gradient, sop_subcategories(id, sop_lessons(id))")
    .eq("department_slug", department.slug)
    .order("position", { ascending: true });

  const sops: SopSummary[] = (sopsData ?? []).map((s) => {
    const subcategories = s.sop_subcategories as { id: string; sop_lessons: { id: string }[] }[];
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      description: s.description,
      gradient: s.gradient,
      subcategoryCount: subcategories.length,
      lessonCount: subcategories.reduce((total, c) => total + c.sop_lessons.length, 0),
    };
  });

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

        <div className="mt-8">
          <DepartmentSopsGrid departmentSlug={department.slug} sops={sops} isAdmin={isAdmin} />
        </div>
      </main>
    </div>
  );
}
