import { Play } from "lucide-react";

export function VideoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-black text-neutral-400">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
        <Play size={22} className="ml-0.5 text-white" fill="currentColor" />
      </span>
      <span className="text-sm">{label}</span>
    </div>
  );
}
