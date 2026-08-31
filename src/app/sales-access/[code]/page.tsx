import Link from "next/link";
import { Logo } from "@/components/Logo";

export default async function SalesAccessBoardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Logo />
          <Link href="/sales-access" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Enter a different key
          </Link>
        </div>
      </header>

      <iframe
        src={`/sales-board-app/index.html?code=${encodeURIComponent(code)}`}
        title="Sales Team Board"
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
