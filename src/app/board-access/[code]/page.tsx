import Link from "next/link";
import { Logo } from "@/components/Logo";

// Mirrors /sales-access/[code] exactly, except the iframe gets
// ?board_code= instead of ?code= -- routes public/sales-board-app/
// index.html to the multi-board by-code endpoints
// (/api/sales-boards/by-code) instead of the original single-board-per-
// account ones, since this code lives in `sales_boards.access_code`
// (0023_multi_sales_boards.sql), a completely separate code space.
export default async function BoardAccessBoardPage({
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
          <Link href="/board-access" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Enter a different key
          </Link>
        </div>
      </header>

      <iframe
        src={`/sales-board-app/index.html?board_code=${encodeURIComponent(code)}`}
        title="Sales Team Board"
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
