import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src="/logo.png"
        alt="paidcoaching.com"
        width={28}
        height={28}
        className="rounded"
        priority
      />
      <span className="text-lg font-semibold tracking-tight">
        paidcoaching.com
      </span>
    </Link>
  );
}
