import { CalendarClock } from "lucide-react";

export function CalendlyPlaceholder() {
  return (
    <div className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-950 text-neutral-500">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 dark:bg-black/30">
        <CalendarClock size={20} />
      </span>
      <span className="text-sm font-medium">Calendly embed coming soon</span>
    </div>
  );
}
