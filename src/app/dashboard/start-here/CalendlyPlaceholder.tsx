import { CalendarClock } from "lucide-react";

export function CalendlyPlaceholder() {
  return (
    <div className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-black text-neutral-400">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
        <CalendarClock size={22} className="text-white" />
      </span>
      <span className="text-sm">Calendly embed coming soon</span>
    </div>
  );
}
