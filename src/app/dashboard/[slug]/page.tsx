import Link from "next/link";
import { notFound } from "next/navigation";
import { CARDS } from "@/lib/cards";
import { Logo } from "@/components/Logo";

export function generateStaticParams() {
  return CARDS.map((card) => ({ slug: card.slug }));
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = CARDS.find((c) => c.slug === slug);

  if (!card) {
    notFound();
  }

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

      <main className="mx-auto max-w-5xl px-6 py-16 text-center">
        <div className="text-4xl">{card.emoji}</div>
        <h1 className="mt-4 text-2xl font-semibold">{card.title}</h1>
        <p className="mt-2 text-neutral-500">{card.description}</p>
        <p className="mt-8 inline-block rounded-full border border-neutral-300 dark:border-neutral-700 px-4 py-1.5 text-sm text-neutral-500">
          Coming soon
        </p>
      </main>
    </div>
  );
}
