import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src="/logo.png"
        alt="Student Portal"
        width={28}
        height={28}
        className="rounded"
        priority
      />
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-semibold tracking-tight">
          Student Portal
        </span>
        <span className="text-xs text-neutral-500">paidcoaching.com</span>
      </span>
    </Link>
  );
}
