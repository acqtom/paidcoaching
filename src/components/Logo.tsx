import Image from "next/image";
import Link from "next/link";

// The wordmark is baked into logo.png itself (icon + "Paidcoaching.com"
// lockup), so unlike the old square "PC" monogram this no longer needs a
// separate <span> next to it -- that would just repeat the name twice.
// logo-icon.png is that same image cropped down to just the "P" mark
// (122x112, same transparent background), for spots that want the icon
// on its own rather than the full lockup.
export function Logo({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <Link href="/" className="flex items-center">
      {iconOnly ? (
        <Image src="/logo-icon.png" alt="Paidcoaching.com" width={44} height={40} className="h-10 w-auto" priority />
      ) : (
        <Image src="/logo.png" alt="Paidcoaching.com" width={169} height={40} className="h-10 w-auto" priority />
      )}
    </Link>
  );
}
