import Image from "next/image";
import Link from "next/link";

// The wordmark is baked into logo.png itself (icon + "Paidcoaching.com"
// lockup), so unlike the old square "PC" monogram this no longer needs a
// separate <span> next to it -- that would just repeat the name twice.
export function Logo() {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src="/logo.png"
        alt="Paidcoaching.com"
        width={135}
        height={32}
        className="h-8 w-auto"
        priority
      />
    </Link>
  );
}
