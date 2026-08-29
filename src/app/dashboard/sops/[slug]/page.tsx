import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SOPS } from "@/lib/sops";
import { SopDetail } from "./SopDetail";

export function generateStaticParams() {
  return SOPS.map((sop) => ({ slug: sop.slug }));
}

export default async function SopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sop = SOPS.find((s) => s.slug === slug);

  if (!sop) {
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
        <h1 className="text-xl font-semibold">{sop.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{sop.description}</p>

        <div className="mt-6">
          <SopDetail sop={sop} />
        </div>
      </main>
    </div>
  );
}
