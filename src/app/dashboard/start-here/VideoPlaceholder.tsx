import { Play } from "lucide-react";

export function VideoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-950 text-neutral-500">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 dark:bg-black/30">
        <Play size={20} className="ml-0.5" fill="currentColor" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
