import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function SalesBoardPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
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

      <iframe
        src="/sales-board-app/index.html"
        title="Sales Team Board"
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
