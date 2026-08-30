import Link from "next/link";
import { Logo } from "@/components/Logo";
import ContentHubApp from "@/app/dashboard/weekly-content-hub/ContentHubApp";

export default async function TeamAccessHubPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <div className="min-h-screen flex-1 bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Logo />
          <Link href="/team-access" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Enter a different key
          </Link>
        </div>
      </header>

      <ContentHubApp mode="code" code={code} />
    </div>
  );
}
