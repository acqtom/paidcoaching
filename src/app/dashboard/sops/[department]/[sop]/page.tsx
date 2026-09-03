import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { DEPARTMENTS } from "@/lib/sops";
import { isAdminUsername } from "@/lib/is-admin-username";
import { createClient } from "@/lib/supabase/server";
import { SopDetail } from "./SopDetail";
import type { SopDetailData, SopLesson, SopSubcategory } from "@/lib/sop-types";

export default async function SopPage({
  params,
}: {
  params: Promise<{ department: string; sop: string }>;
}) {
  const { department: departmentSlug, sop: sopSlug } = await params;
  const department = DEPARTMENTS.find((d) => d.slug === departmentSlug);
  if (!department) notFound();

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

  const { data: sopRow } = await supabase
    .from("sops")
    .select(
      "id, slug, title, description, sop_subcategories(id, name, position, sop_lessons(id, title, video_url, notes, position))"
    )
    .eq("department_slug", department.slug)
    .eq("slug", sopSlug)
    .maybeSingle();

  if (!sopRow) notFound();

  type RawSubcategory = { id: string; name: string; position: number; sop_lessons: SopLesson[] };
  const subcategories: SopSubcategory[] = (sopRow.sop_subcategories as RawSubcategory[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      lessons: c.sop_lessons.slice().sort((a, b) => a.position - b.position),
    }));

  const sop: SopDetailData = {
    id: sopRow.id,
    slug: sopRow.slug,
    title: sopRow.title,
    description: sopRow.description,
    subcategories,
  };

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
        <SopDetail sop={sop} departmentSlug={department.slug} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
